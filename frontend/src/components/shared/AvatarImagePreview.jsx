import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export default function AvatarImagePreview({ src, alt, children }) {
  if (!src) return children

  const triggerLabel = alt
    ? 'ดูรูปโปรไฟล์ขนาดเต็มของ ' + alt
    : 'ดูรูปโปรไฟล์ขนาดเต็ม'

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          className="shrink-0 cursor-zoom-in rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="w-[calc(100vw-2rem)] max-w-5xl gap-0 overflow-hidden border-0 bg-black/95 p-2 shadow-2xl [&>button]:bg-black/70 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-black"
      >
        <DialogTitle className="sr-only">รูปโปรไฟล์ขนาดเต็ม</DialogTitle>
        <img
          src={src}
          alt={alt || 'รูปโปรไฟล์'}
          className="max-h-[calc(100vh-3rem)] w-full rounded-md object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
