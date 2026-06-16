import os
import secrets

from app.core.security import hash_password
from app.database import SessionLocal
from app.models.user import User, UserRole


def create_first_admin():
    db = SessionLocal()

    username = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD")
    generated_password = False
    if not password:
        password = secrets.token_urlsafe(18)
        generated_password = True

    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print(f"Admin user already exists: {existing.username}")
            return

        admin = User(
            username=username,
            email=os.getenv("ADMIN_EMAIL", "admin@forest.go.th"),
            full_name=os.getenv("ADMIN_FULL_NAME", "ผู้ดูแลระบบ"),
            hashed_password=hash_password(password),
            role=UserRole.ADMIN,
            department=os.getenv("ADMIN_DEPARTMENT", "ฝ่ายเทคโนโลยีสารสนเทศ"),
            position=os.getenv("ADMIN_POSITION", "ผู้ดูแลระบบ"),
            phone=os.getenv("ADMIN_PHONE", "xx-xxxx-xxxx"),
            responsibility=os.getenv(
                "ADMIN_RESPONSIBILITY",
                "ดูแลและพัฒนาระบบสารสนเทศของกรมป่าไม้",
            ),
            motivation=os.getenv("ADMIN_MOTIVATION", "ดูแลระบบ e-Learning"),
        )

        db.add(admin)
        db.commit()

        print("Created admin user.")
        print(f"Username: {username}")
        if generated_password:
            print(f"Generated password: {password}")
            print("Store this password securely; it will not be recoverable later.")
        else:
            print("Password was read from ADMIN_PASSWORD.")

    finally:
        db.close()


if __name__ == "__main__":
    create_first_admin()
