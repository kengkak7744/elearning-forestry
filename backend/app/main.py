from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, users, courses


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

# รวม routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(courses.router)


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