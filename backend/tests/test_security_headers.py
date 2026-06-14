"""Characterization tests for production-grade security headers."""


def test_security_headers_present(client):
    res = client.get("/health")

    assert res.status_code == 200
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "SAMEORIGIN"
    assert res.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "geolocation=()" in res.headers["permissions-policy"]

    csp = res.headers["content-security-policy"]
    assert "default-src 'self'" in csp
    assert "object-src 'none'" in csp
    assert "base-uri 'self'" in csp
    assert "form-action 'self'" in csp
    assert "frame-ancestors 'self'" in csp

    report_only = res.headers["content-security-policy-report-only"]
    assert "require-trusted-types-for 'script'" in report_only
    assert "trusted-types default react" in report_only
