import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export default function CourseSettingsTab({ isNew, courseData, updateField, onRequestDelete }) {
  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">การเผยแพร่</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="ce-pub">เผยแพร่หลักสูตร</Label>
              <p className="text-xs text-muted-foreground">
                หากปิดอยู่ ผู้เรียนจะมองไม่เห็นหลักสูตรนี้
              </p>
            </div>
            <Switch
              id="ce-pub"
              checked={courseData.is_published}
              onCheckedChange={updateField('is_published')}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="ce-mand">หลักสูตรบังคับ</Label>
              <p className="text-xs text-muted-foreground">
                ผู้เรียนทุกคนจำเป็นต้องเรียนหลักสูตรนี้
              </p>
            </div>
            <Switch
              id="ce-mand"
              checked={courseData.is_mandatory}
              onCheckedChange={updateField('is_mandatory')}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="ce-dl">อนุญาตให้ผู้เรียนดาวน์โหลดเอกสาร</Label>
              <p className="text-xs text-muted-foreground">
                เปิด = ผู้เรียนเห็นปุ่มดาวน์โหลด PDF/วิดีโอบนหน้าหลักสูตร
                · ปิด = ดูได้แต่ดาวน์โหลดไม่ได้
              </p>
            </div>
            <Switch
              id="ce-dl"
              checked={courseData.allow_downloads ?? true}
              onCheckedChange={updateField('allow_downloads')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ce-hours">ระยะเวลา (ชั่วโมง)</Label>
            <Input
              id="ce-hours"
              type="number"
              min={0}
              value={courseData.estimated_hours}
              onChange={(e) => updateField('estimated_hours')(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ce-recert">
              อายุใบรับรอง (วัน)
              <span className="ml-1 font-normal text-muted-foreground">
                — เว้นว่าง = ใบรับรองไม่หมดอายุ
              </span>
            </Label>
            <Input
              id="ce-recert"
              type="number"
              min={0}
              value={courseData.recertify_after_days}
              onChange={(e) => updateField('recertify_after_days')(e.target.value)}
              placeholder="เช่น 365 = ต้องอบรมใหม่ทุก 1 ปี"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              เมื่อใบรับรองหมดอายุ ผู้เรียนต้องทำแบบทดสอบสุดท้ายอีกครั้งเพื่อขอใบรับรองใหม่
            </p>
          </div>
        </CardContent>
      </Card>

      {!isNew && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold text-destructive">
              โซนอันตราย
            </h2>
            <p className="text-sm text-muted-foreground">
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={onRequestDelete}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              ลบหลักสูตรนี้
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
