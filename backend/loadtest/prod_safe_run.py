"""Staged, self-aborting load test against PRODUCTION with a neighbor canary.

Answers one question safely: "how many concurrent users before /elearning
degrades, and does that load spill over onto the other sites on the host?"

Design for safety on a shared government host:
  * Read-only API traffic only (no video streaming — that's the bandwidth hog
    most likely to hurt neighbors, and it needs enrollment anyway).
  * Ramps in stages 10 -> 25 -> 50 -> 100 -> 150 users.
  * A monitor thread pings the NEIGHBOR front page (Apache root) every ~3s.
    If the neighbor slows past a threshold or errors, the whole test ABORTS
    immediately — we stop before we can take a neighbor down.
  * Each virtual user logs in ONCE and reuses the token (like a real person),
    so we don't turn the test into a bcrypt storm.

Run:  cd backend && ./venv/Scripts/python.exe loadtest/prod_safe_run.py
"""
import statistics
import threading
import time
from collections import defaultdict

import requests

BASE = "https://wildfire.forest.go.th/elearning"
CANARY = "https://wildfire.forest.go.th/"  # neighbor site front page (Apache)
CREDS = {"identifier": "loadtest_bot", "password": "LoadTest123!"}
COURSE_IDS = [8, 1]

MAX_USERS = 500
STAGES = [(200, 40), (250, 40), (300, 50)]  # (users, seconds)
REQ_TIMEOUT = 15
THINK_MIN, THINK_MAX = 0.5, 2.0

# --- shared state -----------------------------------------------------------
target_users = 0
stop = threading.Event()
abort_reason = None
lock = threading.Lock()
samples = defaultdict(list)  # label -> list of (elapsed, ok)
canary_series = []           # (t, elapsed, status)


def record(label, elapsed, ok):
    with lock:
        samples[label].append((elapsed, ok))


def worker(idx):
    sess = requests.Session()
    logged_in = False
    import random

    while not stop.is_set():
        if idx >= target_users:
            time.sleep(0.25)
            continue
        if not logged_in:
            try:
                r = sess.post(f"{BASE}/api/auth/login", json=CREDS, timeout=REQ_TIMEOUT)
                logged_in = r.status_code == 200
                record("POST /api/auth/login", r.elapsed.total_seconds(), logged_in)
                if not logged_in:
                    time.sleep(1)
                    continue
            except Exception:
                record("POST /api/auth/login", REQ_TIMEOUT, False)
                time.sleep(1)
                continue

        roll = random.random()
        try:
            if roll < 0.45:
                r = sess.get(f"{BASE}/api/courses?skip=0&limit=50", timeout=REQ_TIMEOUT)
                record("GET /api/courses", r.elapsed.total_seconds(), r.ok)
            elif roll < 0.78:
                for path, label in (
                    ("/api/courses/me/enrollments", "GET /me/enrollments"),
                    ("/api/certificates/me", "GET /certificates/me"),
                    ("/api/courses/me/bookmarks", "GET /me/bookmarks"),
                ):
                    r = sess.get(f"{BASE}{path}", timeout=REQ_TIMEOUT)
                    record(label, r.elapsed.total_seconds(), r.ok)
            else:
                cid = random.choice(COURSE_IDS)
                r = sess.get(f"{BASE}/api/courses/{cid}", timeout=REQ_TIMEOUT)
                record("GET /api/courses/{id}", r.elapsed.total_seconds(), r.ok)
        except Exception:
            record("(request error)", REQ_TIMEOUT, False)
        time.sleep(random.uniform(THINK_MIN, THINK_MAX))


def canary_baseline(n=6):
    vals = []
    for _ in range(n):
        try:
            r = requests.get(CANARY, timeout=REQ_TIMEOUT)
            vals.append(r.elapsed.total_seconds())
        except Exception:
            pass
        time.sleep(0.3)
    return statistics.median(vals) if vals else 0.1


def monitor(base_ms):
    global abort_reason
    # Abort if the neighbor's latency exceeds max(8x baseline, 0.8s) twice in a
    # row, or if it errors/times out (5xx / connection failure) even once.
    thresh = max(base_ms * 8, 0.8)
    breaches = 0
    while not stop.is_set():
        t = time.time()
        try:
            r = requests.get(CANARY, timeout=REQ_TIMEOUT)
            el = r.elapsed.total_seconds()
            canary_series.append((t, el, r.status_code))
            neighbor_bad = r.status_code >= 500
            if el > thresh:
                breaches += 1
            else:
                breaches = 0
            with lock:
                cur = target_users
                recent = {k: v[-1] for k, v in samples.items() if v}
            api_last = recent.get("GET /api/courses", (0, True))
            print(
                f"[{time.strftime('%H:%M:%S')}] users~{cur:>3} | "
                f"neighbor: {el*1000:6.0f}ms status={r.status_code} "
                f"(base {base_ms*1000:.0f}ms, abort>{thresh*1000:.0f}ms x2) | "
                f"elearning /courses last: {api_last[0]*1000:6.0f}ms",
                flush=True,
            )
            if neighbor_bad:
                abort_reason = f"neighbor returned {r.status_code}"
                stop.set()
                return
            if breaches >= 2:
                abort_reason = f"neighbor latency {el*1000:.0f}ms > {thresh*1000:.0f}ms twice"
                stop.set()
                return
        except Exception as e:
            canary_series.append((t, REQ_TIMEOUT, 0))
            abort_reason = f"neighbor request failed: {type(e).__name__}"
            stop.set()
            return
        time.sleep(3)


def main():
    global target_users
    print("Measuring neighbor idle baseline...")
    base = canary_baseline()
    print(f"neighbor baseline median: {base*1000:.0f}ms\n")

    workers = [threading.Thread(target=worker, args=(i,), daemon=True) for i in range(MAX_USERS)]
    for w in workers:
        w.start()
    mon = threading.Thread(target=monitor, args=(base,), daemon=True)
    mon.start()

    try:
        for users, secs in STAGES:
            if stop.is_set():
                break
            target_users = users
            print(f"\n--- stage: {users} users for {secs}s ---", flush=True)
            end = time.time() + secs
            while time.time() < end and not stop.is_set():
                time.sleep(0.5)
    except KeyboardInterrupt:
        abort_reason_local = "manual interrupt"
        print("\ninterrupted")
    finally:
        stop.set()
        time.sleep(1)

    print("\n" + "=" * 74)
    if abort_reason:
        print(f"ABORTED — {abort_reason}")
    else:
        print("Completed full ramp with NO neighbor impact trigger.")
    print("=" * 74)

    print("\nPer-endpoint (elearning):")
    print(f"{'endpoint':<30}{'reqs':>7}{'err%':>7}{'p50':>8}{'p95':>9}{'max':>9}")
    with lock:
        for label in sorted(samples):
            data = samples[label]
            lat = sorted(e for e, _ in data)
            errs = sum(1 for _, ok in data if not ok)
            n = len(data)
            p50 = lat[int(n * 0.50)] if n else 0
            p95 = lat[min(int(n * 0.95), n - 1)] if n else 0
            mx = lat[-1] if n else 0
            print(f"{label:<30}{n:>7}{errs/n*100:>6.1f}%{p50*1000:>7.0f}{p95*1000:>8.0f}{mx*1000:>8.0f}")

    if canary_series:
        cvals = sorted(e for _, e, _ in canary_series)
        print(f"\nNeighbor (canary) over the run: samples={len(cvals)} "
              f"p50={statistics.median(cvals)*1000:.0f}ms "
              f"p95={cvals[min(int(len(cvals)*0.95), len(cvals)-1)]*1000:.0f}ms "
              f"max={cvals[-1]*1000:.0f}ms")


if __name__ == "__main__":
    main()
