from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base


class CertSettings(Base):
    """
    Singleton row holding the editable bits of the certificate PDF — the
    organisation name and the two signer blocks at the bottom. Admin can
    update these from the cert-settings page without redeploying.

    Only the row with id=1 is ever used. `get_or_create_cert_settings(db)`
    inserts it lazily on first access so the cert-rendering path doesn't
    need to special-case "not configured yet".
    """
    __tablename__ = "cert_settings"

    id = Column(Integer, primary_key=True, default=1)
    organization_name = Column(String(100), nullable=False, default="กรมป่าไม้")
    left_signer_name = Column(String(150), nullable=False, default="")
    left_signer_title = Column(String(250), nullable=False, default="")
    right_signer_name = Column(String(150), nullable=False, default="")
    right_signer_title = Column(String(250), nullable=False, default="")
    # Optional uploaded PNG signature scans. When set, the PDF renders the
    # image above the dotted line instead of an empty line — used for
    # certificates that need an actual signature rather than a printed name.
    # Stored as the URL path (e.g. "/images/signatures/abc.png"); the
    # filesystem path is the same with a "/app" prefix.
    left_signer_image = Column(String(500), nullable=True)
    right_signer_image = Column(String(500), nullable=True)
    # "two" (default) renders both signer blocks side-by-side. "one" renders
    # ONLY the left signer, centered on the cert. The right fields stay
    # editable in the UI so switching modes is non-destructive — admin can
    # configure both, render with one, switch back later without re-typing.
    signature_mode = Column(String(10), nullable=False, default="two", server_default="two")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
