"""สคริปต์สร้าง admin คนแรกในระบบ"""
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import hash_password


def create_first_admin():
    db = SessionLocal()
    
    try:
        # ตรวจว่ามี admin อยู่แล้วหรือยัง
        existing = db.query(User).filter(User.employee_id == "admin001").first()
        if existing:
            print(f"มี admin อยู่แล้ว: {existing.full_name}")
            return
        
        admin = User(
            employee_id="admin001",
            email="admin@forest.go.th",
            full_name="ผู้ดูแลระบบ",
            hashed_password=hash_password("Admin@1234"),
            role=UserRole.ADMIN,
            department="ฝ่ายเทคโนโลยีสารสนเทศ",
            position="ผู้ดูแลระบบ",
        )
        
        db.add(admin)
        db.commit()
        
        print("    สร้าง admin สำเร็จ!")
        print(f"   เลขประจำตัว: admin001")
        print(f"   รหัสผ่าน: Admin@1234")
        print(f"   เปลี่ยนรหัสผ่านทันทีหลัง login ครั้งแรก")
        
    finally:
        db.close()


if __name__ == "__main__":
    create_first_admin()