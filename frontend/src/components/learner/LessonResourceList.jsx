import { Download, ExternalLink, FileText, Paperclip } from 'lucide-react'
import { mediaUrl } from '@/utils/media'
import { fmtBytes } from '@/utils/formatting'
import { Badge } from '@/components/ui/badge'

function isInternalMediaUrl(url) {
  // Backend-served paths come back as /videos/, /pdfs/, /images/, etc. Anything
  // that doesn't start with http(s) is treated as a same-origin media path and
  // resolved via mediaUrl(). External links open in a new tab unchanged.
  return typeof url === 'string' && !/^https?:\/\//i.test(url)
}

export default function LessonResourceList({ resources }) {
  if (!Array.isArray(resources) || resources.length === 0) return null
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" />
        เอกสารประกอบบทเรียน
      </div>
      <ul className="space-y-1.5">
        {resources.map((r) => {
          const internal = isInternalMediaUrl(r.url)
          const href = internal ? mediaUrl(r.url) : r.url
          const Icon = internal ? Download : ExternalLink
          const size = fmtBytes(r.file_size)
          return (
            <li key={r.id}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground">
                  {r.title}
                </span>
                {r.resource_type && (
                  <Badge variant="secondary" className="font-normal">
                    {r.resource_type}
                  </Badge>
                )}
                {size && (
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {size}
                  </span>
                )}
                <Icon
                  className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
