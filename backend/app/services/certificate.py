"""Certificate domain logic: numbering, expiry, QR, and PDF rendering.

Moved out of the certificates router so the cert-settings preview endpoint
can reuse the renderer without importing a router, and so the eligibility /
expiry rules are unit-testable.
"""
import base64
import io
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import qrcode
from weasyprint import HTML

from app.config import settings
from app.models.certificate import Certificate
from app.models.course import Course
from app.models.user import User


def generate_certificate_number() -> str:
    return f"CERT-{datetime.utcnow():%Y%m%d}-{secrets.token_hex(3).upper()}"


def compute_expires_at(course: Course, issued_at: datetime | None = None) -> datetime | None:
    """Snapshot expiry for a freshly-issued certificate.

    None when the course has no recertification policy (permanent cert).
    Always uses UTC; comparisons elsewhere also use UTC-aware datetimes.
    """
    days = course.recertify_after_days
    if not days or days <= 0:
        return None
    base = issued_at or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    return base + timedelta(days=days)


def is_expired(cert: Certificate) -> bool:
    if not cert.expires_at:
        return False
    exp = cert.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp < datetime.now(timezone.utc)


def verify_url(cert_number: str) -> str:
    """The URL/text the QR code points at.

    With PUBLIC_BASE_URL set, the QR scans into a working verify link. Without
    it (dev, or before the prod domain is configured), we still encode the
    certificate number as plain text so a scanner shows something useful and
    the recipient can type it into the verify page manually.
    """
    base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    if base:
        return f"{base}/verify/{cert_number}"
    return cert_number


def _qr_data_uri(text: str) -> str:
    """Render a QR PNG and return a data: URI ready to drop into an <img src>.

    Inline rather than disk-write because WeasyPrint reads the HTML at render
    time — fetching from disk would require absolute paths and cleanup. Box-size
    of 4 + medium error correction renders a ~200px QR at print resolution,
    which scans reliably from a phone held 20cm away.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=2,
    )
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0F6E56", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


_THAI_MONTHS = [
    "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]
_THAI_DIGITS = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")


def format_thai_date(d: datetime) -> str:
    """Render '๑๕ พฤศจิกายน พ.ศ. ๒๕๖๗' style dates — matches the official cert
    layout the department uses on paper."""
    day = str(d.day).translate(_THAI_DIGITS)
    month = _THAI_MONTHS[d.month]
    year = str(d.year + 543).translate(_THAI_DIGITS)
    return f"{day} {month} พ.ศ. {year}"


def build_certificate_html(cert, user, course, db=None) -> str:
    """Return the cert PDF as an HTML string. Split from
    `render_certificate_pdf` so the preview endpoint can render to bytes
    without writing to disk. Accepts duck-typed cert/user/course (real
    ORM rows OR stub objects with the same attributes) — used to keep
    the preview path free of DB insertion.

    Layout intentionally mirrors the official Royal Forest Department
    paper certificate: gold layered border, organisation header, recipient
    name centred and oversized, course title, Thai-numeral Buddhist Era
    date, and two signature blocks at the bottom whose names and titles
    come from `cert_settings` (admin-editable). QR code sits in the
    bottom-right corner for public verification."""
    from app.models.cert_settings import CertSettings

    issued = cert.issued_at or datetime.utcnow()
    qr_uri = _qr_data_uri(verify_url(cert.certificate_number))
    verify_label = (
        "สแกนเพื่อตรวจสอบความถูกต้อง"
        if settings.PUBLIC_BASE_URL
        else "สแกนเพื่อดูเลขที่ใบรับรอง"
    )

    cs: CertSettings | None = None
    if db is not None:
        cs = db.query(CertSettings).first()
    org = (cs.organization_name if cs else "") or "กรมป่าไม้"
    left_name = (cs.left_signer_name if cs else "") or ""
    left_title = (cs.left_signer_title if cs else "") or ""
    right_name = (cs.right_signer_name if cs else "") or ""
    right_title = (cs.right_signer_title if cs else "") or ""
    left_image_url = (cs.left_signer_image if cs else None) or None
    right_image_url = (cs.right_signer_image if cs else None) or None

    score_line = (
        f"<p class='score'>คะแนนสอบสุดท้าย <strong>{int(cert.final_score)}%</strong></p>"
        if cert.final_score is not None else ""
    )

    def _signature_image_uri(url: str | None) -> str | None:
        """Resolve a stored signature URL (e.g. '/images/signatures/abc.png')
        to a base64 data URI WeasyPrint can embed without any URL fetching
        gymnastics. Returns None if the file isn't on disk."""
        if not url:
            return None
        # Signature URLs always point into the signatures dir; resolve by name.
        fs = Path(settings.SIGNATURE_DIR) / Path(url).name
        if not fs.exists() or not fs.is_file():
            return None
        try:
            data = fs.read_bytes()
        except OSError:
            return None
        return "data:image/png;base64," + base64.b64encode(data).decode("ascii")

    left_image_uri = _signature_image_uri(left_image_url)
    right_image_uri = _signature_image_uri(right_image_url)

    # Header crest: department logo above the org name. Picked up from a
    # known filesystem path so deploy is "drop the PNG in this folder" —
    # no DB row, no upload endpoint. The images dir is the same volume that
    # holds cover images, so existing infra carries it.
    logo_uri = None
    _logo_fs = Path(settings.IMAGE_DIR) / "forest_logo.png"
    if _logo_fs.exists() and _logo_fs.is_file():
        try:
            logo_uri = (
                "data:image/png;base64,"
                + base64.b64encode(_logo_fs.read_bytes()).decode("ascii")
            )
        except OSError:
            logo_uri = None
    logo_html = (
        f"<img class='header-logo' src='{logo_uri}' alt='' />"
        if logo_uri else ""
    )

    # Each signature block renders only when at least one of name / title /
    # image is set, so an un-configured cert just shows the body + date + QR
    # without empty signature lines hanging off the bottom. When an image is
    # uploaded we use it INSTEAD of the dotted line so the cert reads like a
    # genuinely-signed document.
    def _sig_block(name: str, title: str, image_uri: str | None) -> str:
        if not (name or title or image_uri):
            return ""
        if image_uri:
            line_html = f"<img class='sig-image' src='{image_uri}' alt='signature' />"
        else:
            line_html = "<div class='sig-line'></div>"
        name_html = f"<div class='sig-name'>({name})</div>" if name else ""
        title_html = f"<div class='sig-title'>{title}</div>" if title else ""
        return f"<div class='sig'>{line_html}{name_html}{title_html}</div>"

    left_sig = _sig_block(left_name, left_title, left_image_uri)
    right_sig = _sig_block(right_name, right_title, right_image_uri)
    # signature_mode toggle: "one" = render only the LEFT signer (centered);
    # "two" (default) = render both side-by-side. Setting "one" doesn't
    # touch the right-side fields in the database, so switching back to
    # "two" later restores both without re-typing.
    sig_mode = (cs.signature_mode if cs else "two") or "two"
    if sig_mode == "one":
        right_sig = ""
    sigs_class = "single" if sig_mode == "one" else "dual"
    issued_date_th = format_thai_date(issued)

    html = f"""
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap"
        />
        <style>
            @page {{ size: A4 landscape; margin: 0; }}

            body {{
                margin: 0;
                font-family: 'Sarabun', 'DejaVu Sans', sans-serif;
                background: #FFFFFF;
                color: #1F2937;
            }}

            .outer {{
                margin: 5mm;
                padding: 3mm;
                height: calc(210mm - 10mm - 6mm);
                box-sizing: border-box;
            }}

            .mid {{
                padding: 2mm;
                height: 100%;
                box-sizing: border-box;
            }}

            .frame {{
                padding: 6mm 16mm 28mm 16mm;
                height: 100%;
                box-sizing: border-box;
                background: #FFFFFF;
                text-align: center;
                position: relative;
                overflow: hidden;
            }}

            .header-logo {{
                display: block;
                width: 32mm;
                height: 32mm;
                margin: 0 auto 1mm;
                object-fit: contain;
            }}

            .org {{
                font-size: 43pt;
                font-weight: 600;
                color: #0E4B36;
                margin: 0 0 1mm;
                letter-spacing: 0.02em;
                line-height: 1.1;
            }}

            .org-rule {{
                width: 60mm;
                height: 0;
                border-top: 2px solid #D4A017;
                margin: 1mm auto 4mm;
            }}

            .intro {{
                font-size: 18pt;
                margin: 0 0 3mm;
            }}

            /* Recipient name with flanking gold flourishes. Flex layout means
               the side rules grow / shrink to fill, so a short or long name
               both look balanced — no hard-coded widths to fight. */
            .recipient-row {{
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8mm;
                margin: 4mm 0 6mm;
            }}
            .flourish {{
                flex: 1 1 0;
                max-width: 50mm;
                min-width: 12mm;
                height: 0;
                border-top: 1.5px solid #D4A017;
                position: relative;
            }}
            .flourish::before,
            .flourish::after {{
                content: '';
                position: absolute;
                top: -1mm;
                width: 2mm;
                height: 2mm;
                background: #D4A017;
                transform: rotate(45deg);
            }}
            .flourish::before {{ left: 0; }}
            .flourish::after {{ right: 0; }}
            .recipient {{
                font-size: 28pt;
                color: #111827;
                letter-spacing: 0.01em;
                white-space: nowrap;
            }}

            .course-intro {{
                font-size: 18pt;
                font-weight: 600;
                margin: 0 0 2mm;
            }}

            .course {{
                font-size: 18pt;
                font-weight: 600;
                color: #0E4B36;
                margin: 0 0 3mm;
                line-height: 1.35;
            }}

            .score {{
                font-size: 11pt;
                color: #4B5563;
                margin: 0 0 2mm;
            }}

            .score strong {{
                color: #0E4B36;
            }}

            .date {{
                font-size: 13pt;
                color: #374151;
                margin: 4mm 0 0;
            }}

            .sigs {{
                margin: 8mm 0 0;
                display: flex;
                align-items: flex-start;
                gap: 10mm;
            }}
            .sigs.dual {{
                justify-content: space-around;
            }}
            .sigs.dual .sig {{
                flex: 1;
            }}
            /* One-signer layout: don't stretch — fix to a sensible width and
               center horizontally. Otherwise a single flex:1 block fills the
               row, which looks like a layout bug. */
            .sigs.single {{
                justify-content: center;
            }}
            .sigs.single .sig {{
                flex: 0 0 auto;
                width: 90mm;
            }}

            .sig {{
                text-align: center;
                font-size: 13pt;
                color: #374151;
            }}

            .sig-line {{
                width: 60mm;
                margin: 0 auto 2mm;
                border-bottom: 1px dotted #6B7280;
                height: 12mm;
            }}

            .sig-image {{
                display: block;
                max-width: 60mm;
                max-height: 18mm;
                margin: 0 auto 1mm;
                object-fit: contain;
            }}

            .sig-name {{
                font-weight: 600;
                color: #1F2937;
            }}

            .sig-title {{
                font-size: 13pt;
                color: #4B5563;
                margin-top: 0.5mm;
            }}

            .footer-row {{
                position: absolute;
                left: 16mm;
                right: 16mm;
                bottom: 3mm;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                font-size: 9pt;
                color: #6B7280;
            }}

            .cert-no {{
                text-align: left;
            }}

            .cert-no strong {{
                font-family: 'DejaVu Sans Mono', monospace;
                color: #1F2937;
            }}

            .qr {{
                text-align: right;
            }}

            .qr img {{
                margin-top: 2mm;
                width: 18mm;
                height: 18mm;
                display: inline-block;
            }}

            .qr .qr-label {{
                font-size: 7.5pt;
                color: #6B7280;
            }}
        </style>
    </head>
    <body>
      <div class="outer">
        <div class="mid">
          <div class="frame">
            {logo_html}
            <div class="org">{org}</div>
            <div class="org-rule"></div>
            <p class="intro">ขอมอบประกาศนียบัตรให้ไว้เพื่อแสดงว่า</p>
            <div class="recipient-row">
              <span class="flourish left"></span>
              <span class="recipient">{user.full_name}</span>
              <span class="flourish right"></span>
            </div>
            <p class="course-intro">ได้สำเร็จการฝึกอบรมหลักสูตร</p>
            <div class="course">{course.title}</div>
            {score_line}
            <p class="date">ให้ไว้ ณ วันที่ {issued_date_th}</p>

            <div class="sigs {sigs_class}">
              {left_sig}
              {right_sig}
            </div>

            <div class="footer-row">
              <div class="cert-no">
                เลขที่ใบรับรอง <strong>{cert.certificate_number}</strong>
              </div>
              <div class="qr">
                <img src="{qr_uri}" alt="QR" />
                <div class="qr-label">{verify_label}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
    """

    return html


def render_certificate_pdf(cert: Certificate, user: User, course: Course, db=None) -> Path:
    """Write a PDF for this certificate and return the path."""
    html = build_certificate_html(cert, user, course, db=db)
    cert_dir = Path(settings.CERT_DIR)
    cert_dir.mkdir(parents=True, exist_ok=True)
    path = cert_dir / f"{cert.certificate_number}.pdf"
    HTML(string=html).write_pdf(target=str(path))
    return path


def render_certificate_pdf_bytes(cert, user, course, db=None) -> bytes:
    """Render the certificate to PDF bytes (no disk write) — used by the
    admin preview endpoint."""
    html = build_certificate_html(cert, user, course, db=db)
    return HTML(string=html).write_pdf()
