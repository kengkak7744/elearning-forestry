import { useEffect, useRef, useState } from 'react'
import { Award, Eye, Save, Trash2, Upload } from 'lucide-react'
import { certSettingsApi } from '@/api/certSettings'
import { showToast } from '@/lib/toast'
import { mediaUrl } from '@/utils/media'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toastApiError } from '@/utils/apiError'

// `side` controls visibility per signature_mode. 'org' always shows;
// 'left' always shows; 'right' is hidden when signature_mode === 'one'.
// Each entry has two label variants so the form reads naturally in either
// mode — left fields lose the "ฝั่งซ้าย" suffix when there's only one signer.
const FIELDS = [
  {
    key: 'organization_name',
    side: 'org',
    label: 'ชื่อหน่วยงาน',
    labelOne: 'ชื่อหน่วยงาน',
    hint: 'ปรากฏเป็นหัวเรื่องด้านบนของใบรับรอง (เช่น "กรมป่าไม้")',
    placeholder: 'กรมป่าไม้',
  },
  {
    key: 'left_signer_name',
    side: 'left',
    label: 'ผู้ลงนามฝั่งซ้าย — ชื่อ-สกุล',
    labelOne: 'ผู้ลงนาม — ชื่อ-สกุล',
    hint: 'ปรากฏใต้เส้นลายเซ็น เช่น "นายเก่ง ใจดี"',
    placeholder: 'นายเก่ง ใจดี',
  },
  {
    key: 'left_signer_title',
    side: 'left',
    label: 'ผู้ลงนามฝั่งซ้าย — ตำแหน่ง',
    labelOne: 'ผู้ลงนาม — ตำแหน่ง',
    hint: 'ปรากฏใต้ชื่อ',
    placeholder: 'ผู้อำนวยการสำนักป้องกันรักษาป่าและควบคุมไฟป่า',
  },
  {
    key: 'right_signer_name',
    side: 'right',
    label: 'ผู้ลงนามฝั่งขวา — ชื่อ-สกุล',
    labelOne: '',
    hint: 'ปรากฏใต้เส้นลายเซ็นฝั่งขวา เช่น "นายเก่ง ใจดี"',
    placeholder: 'นายเก่ง ใจดี',
  },
  {
    key: 'right_signer_title',
    side: 'right',
    label: 'ผู้ลงนามฝั่งขวา — ตำแหน่ง',
    labelOne: '',
    hint: 'ปรากฏใต้ชื่อ',
    placeholder: 'อธิบดีกรมป่าไม้',
  },
]

function SignatureUploader({ side, label, value, onChange }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handlePick = () => fileRef.current?.click()

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // Client-side guards — backend re-validates regardless.
    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
      showToast('รองรับเฉพาะไฟล์ PNG เท่านั้น', 'error')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('ไฟล์ต้องไม่เกิน 2 MB', 'error')
      return
    }
    setUploading(true)
    try {
      const updated = await certSettingsApi.uploadSignature(side, file)
      onChange(updated)
      showToast('อัปโหลดลายเซ็นเรียบร้อย', 'success')
    } catch (err) {
      toastApiError(err, 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    setUploading(true)
    try {
      const updated = await certSettingsApi.deleteSignature(side)
      onChange(updated)
      showToast('ลบลายเซ็นเรียบร้อย', 'success')
    } catch (err) {
      toastApiError(err, 'ลบไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-20 w-40 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-2">
          {value ? (
            <img
              src={mediaUrl(value)}
              alt={`signature ${side}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-[11px] text-muted-foreground">
              ยังไม่มีลายเซ็น
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,.png"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePick}
            disabled={uploading}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {value ? 'เปลี่ยนลายเซ็น' : 'อัปโหลดลายเซ็น'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={uploading}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              ลบ
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        ไฟล์ PNG ขนาดไม่เกิน 2 MB — แนะนำให้ใช้ภาพลายเซ็นพื้นหลังโปร่งใส
        เพื่อให้ดูสมจริงเมื่อพิมพ์ทับเส้นจุดบนใบรับรอง
      </p>
    </div>
  )
}

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
        toastApiError(err, 'โหลดข้อมูลไม่สำเร็จ')
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
      toastApiError(err, 'บันทึกไม่สำเร็จ')
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
              {/* Signature mode — explicit 1 vs 2 toggle. Storing this
                  separately from the field values means switching back and
                  forth doesn't wipe whatever's typed on the unused side. */}
              <div className="space-y-1.5">
                <Label>จำนวนผู้ลงนามบนใบรับรอง</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      (data.signature_mode ?? 'two') === 'two'
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() =>
                      setData((prev) => ({ ...prev, signature_mode: 'two' }))
                    }
                  >
                    ผู้ลงนาม 2 คน
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      data.signature_mode === 'one' ? 'default' : 'outline'
                    }
                    onClick={() =>
                      setData((prev) => ({ ...prev, signature_mode: 'one' }))
                    }
                  >
                    ผู้ลงนามคนเดียว
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  เมื่อเลือก "ผู้ลงนามคนเดียว" ระบบจะใช้เฉพาะข้อมูลฝั่งซ้าย
                  และจัดวางกึ่งกลางใบรับรอง — ข้อมูลฝั่งขวายังเก็บไว้
                  สลับโหมดได้โดยไม่เสียข้อมูล
                </p>
              </div>

              {FIELDS.filter(
                (f) =>
                  !(f.side === 'right' && (data.signature_mode ?? 'two') === 'one')
              ).map((f) => {
                const isOne = (data.signature_mode ?? 'two') === 'one'
                const label = isOne ? f.labelOne || f.label : f.label
                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={f.key}>{label}</Label>
                    <Input
                      id={f.key}
                      value={data[f.key] ?? ''}
                      onChange={handleChange(f.key)}
                      placeholder={f.placeholder}
                      maxLength={250}
                    />
                    <p className="text-xs text-muted-foreground">{f.hint}</p>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="mt-4 border-border/60">
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-foreground">
                ภาพลายเซ็น
              </h2>
              <p className="text-xs text-muted-foreground">
                อัปโหลดไฟล์ PNG ลายเซ็นจริง — จะแสดงเหนือชื่อแทนเส้นจุดบนใบรับรอง
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <SignatureUploader
                side="left"
                label={
                  (data.signature_mode ?? 'two') === 'one'
                    ? 'ลายเซ็นผู้ลงนาม'
                    : 'ลายเซ็นฝั่งซ้าย'
                }
                value={data.left_signer_image}
                onChange={setData}
              />
              {(data.signature_mode ?? 'two') !== 'one' && (
                <SignatureUploader
                  side="right"
                  label="ลายเซ็นฝั่งขวา"
                  value={data.right_signer_image}
                  onChange={setData}
                />
              )}
            </CardContent>
          </Card>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button asChild type="button" variant="outline">
              <a
                href={certSettingsApi.previewUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Eye className="mr-1.5 h-4 w-4" />
                ดูตัวอย่างใบรับรอง
              </a>
            </Button>
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
