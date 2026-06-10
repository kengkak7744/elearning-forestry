export const REGISTER_STEPS = [
  { key: 'account', label: 'บัญชี' },
  { key: 'personal', label: 'ข้อมูลส่วนตัว' },
  { key: 'study', label: 'ข้อมูลการเรียน' },
]

export function validateStep(step, form) {
  const errors = {}
  if (step === 0) {
    if (!form.username || form.username.length < 3)
      errors.username = 'ต้องมีอย่างน้อย 3 ตัวอักษร'
    else if (!/^[a-zA-Z0-9_.-]+$/.test(form.username))
      errors.username = 'ใช้ได้เฉพาะ a-z, 0-9, _ . -'
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    if (!form.password || form.password.length < 6)
      errors.password = 'อย่างน้อย 6 ตัวอักษร'
    if (form.confirm_password !== form.password)
      errors.confirm_password = 'รหัสผ่านไม่ตรงกัน'
  } else if (step === 1) {
    if (!form.full_name || form.full_name.length < 2)
      errors.full_name = 'กรุณากรอกชื่อ-นามสกุล'
    if (!form.phone || form.phone.length < 9)
      errors.phone = 'เบอร์โทรศัพท์ไม่ถูกต้อง'
    if (!form.department || form.department.length < 2)
      errors.department = 'กรุณากรอกหน่วยงาน'
    if (!form.position || form.position.length < 2)
      errors.position = 'กรุณากรอกตำแหน่ง'
  } else if (step === 2) {
    if (!form.responsibility || form.responsibility.length < 5)
      errors.responsibility = 'อย่างน้อย 5 ตัวอักษร'
    if (!form.motivation || form.motivation.length < 5)
      errors.motivation = 'อย่างน้อย 5 ตัวอักษร'
  }
  return errors
}
