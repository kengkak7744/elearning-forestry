import {
  Ban,
  BookOpen,
  Check,
  FileText,
  Film,
  GraduationCap,
  Home,
  Hourglass,
  Image as ImageIcon,
  LogOut,
  Lock,
  Pause,
  Settings,
  StickyNote,
  Timer,
  Trees,
  Trophy,
  Tv,
  User as UserIcon,
  X,
  XCircle,
} from 'lucide-react'

/**
 * Legacy Icon shim — maps the project's original icon names to lucide-react.
 * New code should import from `lucide-react` directly; this exists so older
 * components (MyCourses, QuizTaker, etc.) keep rendering without rewrites.
 */
const map = {
  home: Home,
  user: UserIcon,
  settings: Settings,
  logout: LogOut,
  book: BookOpen,
  graduation: GraduationCap,
  check: Check,
  close: X,
  ban: Ban,
  pause: Pause,
  note: StickyNote,
  xmark: XCircle,
  tree: Trees,
  trophy: Trophy,
  document: FileText,
  tv: Tv,
  film: Film,
  stopwatch: Timer,
  hourglass: Hourglass,
  lock: Lock,
  image: ImageIcon,
}

export default function Icon({ name, className = 'w-5 h-5', title }) {
  const Cmp = map[name]
  if (!Cmp) return null
  // When there's a title, the icon is informative — give it an accessible name
  // and a role so screen readers announce it. When there isn't, the icon is
  // decorative and must be fully hidden from AT (otherwise lucide's default
  // `role="img"` produces an unnamed "image" announcement).
  if (title) {
    return <Cmp className={className} role="img" aria-label={title} />
  }
  return <Cmp className={className} aria-hidden="true" focusable="false" />
}
