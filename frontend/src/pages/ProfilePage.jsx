import { useAuth } from '@/contexts/AuthContext'
import { ROLE_LABELS } from '@/constants/labels'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { mediaUrl } from '@/utils/media'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ProfileTab from '@/components/profile/ProfileTab'
import SecurityTab from '@/components/profile/SecurityTab'
import MyCoursesTab from '@/components/profile/MyCoursesTab'
import BookmarksTab from '@/components/profile/BookmarksTab'
import CertificatesTab from '@/components/profile/CertificatesTab'
import AvatarImagePreview from '@/components/shared/AvatarImagePreview'
import { initials } from '@/utils/formatting'

export default function ProfilePage() {
  useDocumentTitle('โปรไฟล์')
  const { user } = useAuth()

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Profile header */}
      <Card className="mb-6 border-border/60">
        <CardContent className="flex items-center gap-4 p-5">
          <AvatarImagePreview
            src={user?.profile_image ? mediaUrl(user.profile_image) : undefined}
            alt={user?.full_name || ''}
          >
            <Avatar className="h-14 w-14">
              {user?.profile_image && (
                <AvatarImage src={mediaUrl(user.profile_image)} alt={user?.full_name || ''} />
              )}
              <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                {initials(user?.full_name)}
              </AvatarFallback>
            </Avatar>
          </AvatarImagePreview>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground">
              {user?.full_name}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {user?.email} · {ROLE_LABELS[user?.role]}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="w-full">
        {/* flex-wrap on mobile: 5 tabs overflow 390px, and a scrollable row
            hides the last tab (ใบรับรอง) with no affordance — wrap instead */}
        <TabsList className="mb-6 h-auto w-full flex-wrap justify-start gap-1 sm:w-auto sm:flex-nowrap">
          <TabsTrigger value="profile">โปรไฟล์</TabsTrigger>
          <TabsTrigger value="security">ความปลอดภัย</TabsTrigger>
          <TabsTrigger value="courses">หลักสูตรของฉัน</TabsTrigger>
          <TabsTrigger value="bookmarks">บุ๊กมาร์ก</TabsTrigger>
          <TabsTrigger value="certificates">ใบรับรอง</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="courses">
          <MyCoursesTab />
        </TabsContent>
        <TabsContent value="bookmarks">
          <BookmarksTab />
        </TabsContent>
        <TabsContent value="certificates">
          <CertificatesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
