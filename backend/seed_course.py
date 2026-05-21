"""สคริปต์สร้างหลักสูตรตัวอย่าง"""
from app.database import SessionLocal
from app.models.course import Course, CourseCategory


SAMPLE_COURSES = [
    {
        "title": "กฎหมายป่าไม้และป่าสงวนแห่งชาติ",
        "description": "ความรู้พื้นฐานเกี่ยวกับ พ.ร.บ. ป่าไม้ พ.ศ. 2484 และ พ.ร.บ. ป่าสงวนแห่งชาติ พ.ศ. 2507 รวมถึงระเบียบที่เกี่ยวข้อง สำหรับเจ้าหน้าที่ทุกระดับ",
        "category": CourseCategory.COMPLIANCE,
        "is_mandatory": True,
        "estimated_hours": 8,
        "is_published": True,
        "instructor_name": "ดร. สมศักดิ์ พงษ์พันธ์",
    },
    {
        "title": "การสำรวจและจัดทำข้อมูลทรัพยากรป่าไม้",
        "description": "หลักการสำรวจป่า การวัดต้นไม้ การเก็บข้อมูลภาคสนาม และการใช้แบบฟอร์มสำรวจ เหมาะสำหรับนักวิชาการป่าไม้และเจ้าพนักงานป่าไม้",
        "category": CourseCategory.TECHNICAL,
        "is_mandatory": False,
        "estimated_hours": 12,
        "is_published": True,
        "instructor_name": "อ. วันชัย ใจสะอาด",
    },
    {
        "title": "การดับไฟป่าและการป้องกันภัยพิบัติ",
        "description": "เทคนิคการดับไฟป่า การใช้อุปกรณ์ดับไฟ ความปลอดภัยส่วนบุคคล และการประสานงานกับชุมชน",
        "category": CourseCategory.SAFETY,
        "is_mandatory": True,
        "estimated_hours": 6,
        "is_published": True,
        "instructor_name": "นายประวิทย์ ผจญไฟ",
    },
    {
        "title": "การใช้ระบบ GIS เพื่อจัดการป่าไม้",
        "description": "พื้นฐาน GIS การใช้โปรแกรม QGIS การวิเคราะห์พื้นที่ป่า และการจัดทำแผนที่",
        "category": CourseCategory.SKILL,
        "is_mandatory": False,
        "estimated_hours": 16,
        "is_published": True,
        "instructor_name": "ผศ.ดร. นิภาพร แผนที่ดี",
    },
    {
        "title": "จริยธรรมและธรรมาภิบาลในราชการ",
        "description": "หลักจริยธรรมข้าราชการ ระเบียบสำนักนายกรัฐมนตรี และกรณีศึกษาจริง",
        "category": CourseCategory.COMPLIANCE,
        "is_mandatory": True,
        "estimated_hours": 4,
        "is_published": True,
        "instructor_name": "ดร. มานพ ธรรมาภิบาล",
    },
]


def seed_courses():
    db = SessionLocal()
    
    try:
        existing_count = db.query(Course).count()
        if existing_count > 0:
            print(f"มีหลักสูตรในระบบแล้ว {existing_count} หลักสูตร")
            response = input("ต้องการเพิ่มหลักสูตรตัวอย่างหรือไม่? (y/N): ")
            if response.lower() != 'y':
                return
        
        for course_data in SAMPLE_COURSES:
            course = Course(**course_data)
            db.add(course)
        
        db.commit()
        
        print(f"สร้างหลักสูตรตัวอย่าง {len(SAMPLE_COURSES)} หลักสูตรสำเร็จ!")
        for c in SAMPLE_COURSES:
            status = "published" if c["is_published"] else "draft"
            mandatory = "บังคับ" if c["is_mandatory"] else ""
            print(f"   - {c['title']} ({status}) {mandatory}")
        
    finally:
        db.close()


if __name__ == "__main__":
    seed_courses()