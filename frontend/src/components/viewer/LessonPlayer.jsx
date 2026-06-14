import { mediaUrl } from '@/utils/media'
import { getYoutubeEmbed } from '@/utils/youtube'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * The per-content-type media surface (video_file / video_youtube / pdf / empty).
 * Video and YouTube render in a 16:9 box; PDFs get a taller portrait-leaning
 * container since they're almost always A4 portrait and 16:9 wastes huge
 * amounts of vertical space.
 *
 * Refs and event handlers are owned by the page (so the mid-video-quiz and
 * YouTube player hooks keep working) and passed in. `overlay` is rendered on
 * top of the media — used for the up-next card.
 */
export default function LessonPlayer({
  lesson,
  videoRef,
  ytIframeRef,
  onTimeUpdate,
  onEnded,
  onLoadedMetadata,
  overlay,
}) {
  const isPdf = lesson.content_type === 'pdf'
  const captionUrl = lesson.caption_url || lesson.captions_url
  return (
    <Card className="mb-4 overflow-hidden border-border/60">
      <div
        className={cn(
          'relative',
          isPdf ? 'h-[78vh] min-h-[520px] bg-muted' : 'aspect-video bg-black'
        )}
      >
        {lesson.content_type === 'video_file' && lesson.content_url && (
          <video
            ref={videoRef}
            src={mediaUrl(lesson.content_url)}
            controls
            className="h-full w-full"
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
            onLoadedMetadata={onLoadedMetadata}
          >
            {captionUrl && (
              <track
                kind="captions"
                src={mediaUrl(captionUrl)}
                srcLang="th"
                label="ไทย"
                default
              />
            )}
          </video>
        )}
        {lesson.content_type === 'video_youtube' && lesson.content_url && (
          <iframe
            ref={ytIframeRef}
            key={lesson.id}
            src={getYoutubeEmbed(lesson.content_url)}
            title={lesson.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
        {isPdf && lesson.content_url && (
          <iframe
            src={mediaUrl(lesson.content_url)}
            title={lesson.title}
            className="h-full w-full bg-white"
          />
        )}
        {!lesson.content_url && (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/80">
            ยังไม่มีเนื้อหาในบทเรียนนี้
          </div>
        )}
        {overlay}
      </div>
    </Card>
  )
}
