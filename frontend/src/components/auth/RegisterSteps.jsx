import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import FormField from '@/components/auth/FormField'
import PasswordInput from '@/components/shared/PasswordInput'

export function AccountStep({ form, errors, update }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="reg-username"
          label="ชื่อผู้ใช้ (Username)"
          required
          error={errors.username}
          hint="ใช้ได้เฉพาะ a-z, 0-9, _ . -"
        >
          <Input
            id="reg-username"
            value={form.username}
            onChange={update('username')}
            placeholder="เช่น suphadej.a"
            autoComplete="username"
            autoFocus
          />
        </FormField>
        <FormField id="reg-email" label="อีเมล" required error={errors.email}>
          <Input
            id="reg-email"
            type="email"
            value={form.email}
            onChange={update('email')}
            placeholder="name@forest.go.th"
            autoComplete="email"
          />
        </FormField>
        <FormField
          id="reg-password"
          label="รหัสผ่าน"
          required
          error={errors.password}
          hint="อย่างน้อย 6 ตัวอักษร"
        >
          <PasswordInput
            id="reg-password"
            value={form.password}
            onChange={update('password')}
            placeholder="••••••"
            autoComplete="new-password"
          />
        </FormField>
        <FormField
          id="reg-confirm"
          label="ยืนยันรหัสผ่าน"
          required
          error={errors.confirm_password}
        >
          <PasswordInput
            id="reg-confirm"
            value={form.confirm_password}
            onChange={update('confirm_password')}
            placeholder="พิมพ์รหัสผ่านอีกครั้ง"
            autoComplete="new-password"
          />
        </FormField>
      </div>
    </div>
  )
}

export function PersonalStep({ form, errors, update }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormField
          id="reg-fullname"
          label="ชื่อ-นามสกุล"
          required
          error={errors.full_name}
        >
          <Input
            id="reg-fullname"
            value={form.full_name}
            onChange={update('full_name')}
            placeholder="นายสุภเดช อนุพันธ์"
            autoComplete="name"
            autoFocus
          />
        </FormField>
      </div>
      <FormField id="reg-phone" label="เบอร์โทรศัพท์" required error={errors.phone}>
        <Input
          id="reg-phone"
          type="tel"
          value={form.phone}
          onChange={update('phone')}
          placeholder="081-234-5678"
          autoComplete="tel"
        />
      </FormField>
      <FormField
        id="reg-department"
        label="หน่วยงาน/สังกัด"
        required
        error={errors.department}
      >
        <Input
          id="reg-department"
          value={form.department}
          onChange={update('department')}
          placeholder="สำนักจัดการป่าไม้ภาคที่ 1"
        />
      </FormField>
      <div className="sm:col-span-2">
        <FormField id="reg-position" label="ตำแหน่ง" required error={errors.position}>
          <Input
            id="reg-position"
            value={form.position}
            onChange={update('position')}
            placeholder="เจ้าพนักงานป่าไม้ปฏิบัติงาน"
          />
        </FormField>
      </div>
    </div>
  )
}

export function StudyStep({ form, errors, update }) {
  return (
    <div className="space-y-4">
      <FormField
        id="reg-responsibility"
        label="มีหน้าที่รับผิดชอบอะไร"
        required
        error={errors.responsibility}
        hint={`${form.responsibility.length}/1000 ตัวอักษร`}
      >
        <Textarea
          id="reg-responsibility"
          value={form.responsibility}
          onChange={update('responsibility')}
          rows={3}
          maxLength={1000}
          placeholder="เช่น ดูแลการสำรวจป่าในพื้นที่ จัดทำรายงานประจำเดือน..."
          autoFocus
        />
      </FormField>
      <FormField
        id="reg-motivation"
        label="ทำไมจึงเข้ามาเรียน"
        required
        error={errors.motivation}
        hint={`${form.motivation.length}/1000 ตัวอักษร`}
      >
        <Textarea
          id="reg-motivation"
          value={form.motivation}
          onChange={update('motivation')}
          rows={3}
          maxLength={1000}
          placeholder="เช่น ต้องการพัฒนาความรู้ด้านกฎหมายป่าไม้..."
        />
      </FormField>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-border/60 py-2 last:border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="col-span-2 break-words text-sm text-foreground">{value || '-'}</div>
    </div>
  )
}

export function ReviewSummary({ form }) {
  return (
    <div>
      <h3 className="mb-1 text-base font-semibold text-foreground">ตรวจสอบข้อมูล</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนยืนยันการสมัคร
      </p>
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-2">
        <SummaryRow label="ชื่อผู้ใช้" value={form.username} />
        <SummaryRow label="อีเมล" value={form.email} />
        <SummaryRow label="ชื่อ-นามสกุล" value={form.full_name} />
        <SummaryRow label="เบอร์โทรศัพท์" value={form.phone} />
        <SummaryRow label="หน่วยงาน" value={form.department} />
        <SummaryRow label="ตำแหน่ง" value={form.position} />
        <SummaryRow label="หน้าที่รับผิดชอบ" value={form.responsibility} />
        <SummaryRow label="แรงจูงใจในการเรียน" value={form.motivation} />
      </div>
    </div>
  )
}
