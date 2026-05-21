from app.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import hash_password


def create_first_admin():
    db = SessionLocal()
    
    try:
        existing = db.query(User).filter(User.username == "admin").first()
        if existing:
            print(f"มี admin อยู่แล้ว: {existing.full_name}")
            return
        
        admin = User(
            username="admin",
            email="admin@forest.go.th",
            full_name="ผู้ดูแลระบบ",
            hashed_password=hash_password("Admin@1234"),
            role=UserRole.ADMIN,
            department="ฝ่ายเทคโนโลยีสารสนเทศ",
            position="ผู้ดูแลระบบ",
            phone="xx-xxxx-xxxx",
            responsibility="ดูแลและพัฒนาระบบสารสนเทศของกรมป่าไม้",
            motivation="ทดสอบและพัฒนาระบบ e-Learning",
        )

        
        db.add(admin)
        db.commit()
        
        print("    สร้าง admin สำเร็จ!")
        print(f"   ชื่อผู้ใช้: admin")
        print(f"   รหัสผ่าน: Admin@1234")
        print(f"   เปลี่ยนรหัสผ่านทันทีหลัง login ครั้งแรก")
        
    finally:
        db.close()


if __name__ == "__main__":
    create_first_admin()