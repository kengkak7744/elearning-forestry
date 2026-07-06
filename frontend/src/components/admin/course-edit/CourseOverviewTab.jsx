import { useState } from 'react'
import { ImageIcon, Tags } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { mediaUrl } from '@/utils/media'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import ManageCategoriesDialog from '@/components/admin/ManageCategoriesDialog'

export default function CourseOverviewTab({
  isNew,
  courseData,
  updateField,
  coverImage,
  coverUploading,
  coverProgress,
  onCoverUpload,
  onSubmit,
}) {
  const categories = useCategories()
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">ข้อมูลหลักสูตร</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ce-title">
              ชื่อหลักสูตร <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ce-title"
              required
              minLength={3}
              maxLength={200}
              value={courseData.title}
              onChange={(e) => updateField('title')(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ce-description">คำอธิบายหลักสูตร</Label>
            <Textarea
              id="ce-description"
              rows={5}
              value={courseData.description}
              onChange={(e) => updateField('description')(e.target.value)}
            />
          </div>

          {!isNew && (
            <div className="space-y-2">
              <Label>รูปภาพปกหลักสูตร</Label>
              <div className="flex items-start gap-4">
                {coverImage ? (
                  <img
                    src={mediaUrl(coverImage)}
                    alt="ปกหลักสูตร"
                    className="h-20 w-32 flex-shrink-0 rounded-md border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-32 flex-shrink-0 items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={onCoverUpload}
                    disabled={coverUploading}
                    className="text-sm"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    รองรับ JPG, PNG, WEBP ขนาดไม่เกิน 10 MB
                  </p>
                  {coverUploading && (
                    <div className="mt-2 space-y-1">
                      <Progress value={coverProgress} className="h-1.5" />
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {coverProgress}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ce-cat">
                  หมวดหมู่ <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => setCategoriesOpen(true)}
                >
                  {/* Tags — same icon as the courses-list button for this action */}
                  <Tags className="mr-1 h-3 w-3" aria-hidden="true" />
                  จัดการหมวดหมู่
                </Button>
              </div>
              <Select
                value={courseData.category}
                onValueChange={updateField('category')}
              >
                <SelectTrigger id="ce-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-instructor">วิทยากร</Label>
              <Input
                id="ce-instructor"
                maxLength={150}
                value={courseData.instructor_name}
                onChange={(e) => updateField('instructor_name')(e.target.value)}
                placeholder="เช่น ดร. สมศักดิ์ พงษ์พันธ์"
              />
            </div>
          </div>
        </form>
      </CardContent>

      <ManageCategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />
    </Card>
  )
}
