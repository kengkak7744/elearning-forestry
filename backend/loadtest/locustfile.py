"""Load test against a locally running backend.

Usage (from backend/, with the dev server up on :8000):

    ./venv/Scripts/python.exe -m locust -f loadtest/locustfile.py --headless \
        -u 50 -r 10 -t 60s --host http://127.0.0.1:8000

Or with the web UI (open http://localhost:8089):

    ./venv/Scripts/python.exe -m locust -f loadtest/locustfile.py --host http://127.0.0.1:8000

Uses the local dev accounts (uilearner / uiadmin, password UiTest123!) and the
dummy file C:\\app\\videos\\loadtest.mp4. Do NOT point this at production
outside a maintenance window — it generates real traffic and real DB load.
"""
import random

from locust import HttpUser, between, task

PASSWORD = "UiTest123!"
VIDEO_CHUNK = 1024 * 1024  # how much of the stream each "viewer" pulls per request


class Learner(HttpUser):
    """Browsing learner: dashboard + catalog reads — the common traffic shape."""

    weight = 4
    wait_time = between(1, 3)

    def on_start(self):
        self.client.post(
            "/api/auth/login",
            json={"identifier": "uilearner", "password": PASSWORD},
        )
        courses = self.client.get(
            "/api/courses?skip=0&limit=50", name="/api/courses"
        ).json()
        self.course_ids = [c["id"] for c in courses] or [1]

    @task(4)
    def catalog(self):
        self.client.get("/api/courses?skip=0&limit=50", name="/api/courses")

    @task(3)
    def dashboard(self):
        # The parallel fetches DashboardPage fires on load.
        self.client.get("/api/courses/me/enrollments")
        self.client.get("/api/certificates/me")
        self.client.get("/api/courses/me/bookmarks")

    @task(2)
    def course_detail(self):
        cid = random.choice(self.course_ids)
        self.client.get(f"/api/courses/{cid}", name="/api/courses/{id}")


class VideoViewer(HttpUser):
    """Simulates playback: opens the stream, consumes ~1 MB, disconnects.

    FileResponse on starlette 0.38 ignores Range, so a real browser also gets
    one long 200 stream — partial consumption models a player buffering ahead.
    """

    weight = 2
    wait_time = between(0.5, 2)

    def on_start(self):
        self.client.post(
            "/api/auth/login",
            json={"identifier": "uiadmin", "password": PASSWORD},
        )

    @task
    def stream_chunk(self):
        with self.client.get(
            "/videos/loadtest.mp4",
            stream=True,
            catch_response=True,
            name="/videos/loadtest.mp4 (first 1MB)",
        ) as res:
            if res.status_code != 200:
                res.failure(f"status {res.status_code}")
                return
            read = 0
            for chunk in res.iter_content(chunk_size=64 * 1024):
                read += len(chunk)
                if read >= VIDEO_CHUNK:
                    break
            res.success()
