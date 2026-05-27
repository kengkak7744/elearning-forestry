from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.routers import auth, users, courses, modules, lessons, progress, quizzes, files, admin_stats
import os

app = FastAPI(
    title="ระบบ e-Learning กรมป่าไม้",
    description="API สำหรับระบบการเรียนรู้ออนไลน์ของเจ้าหน้าที่กรมป่าไม้",
    version="1.0.0"
)

#React
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compress JSON/text responses ≥ 1 KB. Already-compressed bytes (video/pdf/images) are skipped automatically.
app.add_middleware(GZipMiddleware, minimum_size=1000)

os.makedirs("/app/videos", exist_ok=True)
os.makedirs("/app/pdf_documents", exist_ok=True)
os.makedirs("/app/images", exist_ok=True)

# รวม routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(courses.router)
app.include_router(modules.router)
app.include_router(lessons.router)
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(quizzes.router, prefix="/api/quizzes", tags=["quizzes"])
app.include_router(files.router)
app.include_router(admin_stats.router)

@app.get("/")
def read_root():
    return {
        "message": "ระบบ e-Learning กรมป่าไม้",
        "status": "online",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}