import { useEffect, useState } from 'react'
import { Award, Save } from 'lucide-react'
import { certSettingsApi } from '@/api/certSettings'
import { showToast } from '@/lib/toast'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const FIELDS = [
  {
    key: 'organization_name',
    label: 'ชื่อหน่วยงาน',
    hint: 'ปรากฏเป็นหัวเรื่องด้านบนของใบรับรอง (เช่น "กรมป่าไม้")',
    placeholder: 'กรมป่าไม้',
  },
  {
    key: 'left_signer_name',
    label: 'ผู้ลงนามฝั่งซ้าย — ชื่อ-สกุล',
    hint: 'ปรากฏใต้เส้นลายเซ็นฝั่งซ้าย เช่น "นายทรงศักดิ์ กิตติธารกรณ์"',
    placeholder: 'นายทรงศักดิ์ กิตติธารกรณ์',
  },
  {
    key: 'left_signer_title',
    label: 'ผู้ลงนามฝั่งซ้าย — ตำแหน่ง',
    hint: 'ปรากฏใต้ชื่อ',
    placeholder: 'ผู้อำนวยการสำนักป้องกันรักษาป่าและควบคุมไฟป่า',
  },
  {
    key: 'right_signer_name',
    label: 'ผู้ลงนามฝั่งขวา — ชื่อ-สกุล',
    hint: 'ปรากฏใต้เส้นลายเซ็นฝั่งขวา เช่น "นายสุรชัย อจลบุญ"',
    placeholder: 'นายสุรชัย อจลบุญ',
  },
  {
    key: 'right_signer_title',
    label: 'ผู้ลงนามฝั่งขวา — ตำแหน่ง',
    hint: 'ปรากฏใต้ชื่อ',
    placeholder: 'อธิบดีกรมป่าไม้',
  },
]

export default function AdminCertSettingsPage() {
  useDocumentTitle('ตั้งค่าใบรับรอง')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    certSettingsApi
      .get()
      .then(setData)
      .catch((err) =>
        showToast(err.response?.data?.detail || 'โหลดข้อมูลไม่สำเร็จ', 'error')
      )
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (key) => (e) => {
    const val = e.target.value
    setData((prev) => ({ ...prev, [key]: val }))
  }

  const handleSave = async (e) => {
    e?.preventDefault?.()
    if (!data) return
    setSaving(true)
    try {
      const updated = await certSettingsApi.update(data)
      setData(updated)
      showToast('บันทึกการตั้งค่าเรียบร้อย', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-foreground sm:text-3xl">
          <Award className="h-6 w-6 text-muted-foreground" />
          ตั้งค่าใบรับรอง
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ปรับชื่อหน่วยงานและผู้ลงนามที่ปรากฏบนใบรับรอง — ใบรับรองทุกใบที่ออก
          หลังจากบันทึกจะใช้ค่าใหม่
        </p>
      </div>

      {loading || !data ? (
        <Card className="border-border/60">
          <CardContent className="space-y-4 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSave}>
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-foreground">
                ข้อมูลผู้ลงนาม
              </h2>
              <p className="text-xs text-muted-foreground">
                เว้นว่างได้ — ช่องว่างจะไม่ปรากฏบนใบรับรอง
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    value={data[f.key] ?? ''}
                    onChange={handleChange(f.key)}
                    placeholder={f.placeholder}
                    maxLength={250}
                  />
                  <p className="text-xs text-muted-foreground">{f.hint}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="submit" disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>

          <Card className="mt-6 border-warning/30 bg-warning/5">
            <CardContent className="p-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">หมายเหตุ:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>ใบรับรองที่ออกไปแล้วและถูกเก็บอยู่จะไม่ถูกอัปเดตอัตโนมัติ</li>
                <li>หากต้องการให้ใบรับรองเก่าใช้ค่าใหม่ ให้ลบไฟล์ PDF เก่าจากเซิร์ฟเวอร์
                  (โฟลเดอร์ <span className="font-mono">/app/certificates/</span>)
                  แล้วระบบจะ render ใหม่ตอนผู้ใช้ดาวน์โหลดครั้งถัดไป</li>
                <li>ค่าที่บันทึกใช้กับใบรับรองทุกหลักสูตร (ไม่ใช่ตั้งค่ารายหลักสูตร)</li>
              </ul>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  )
}
