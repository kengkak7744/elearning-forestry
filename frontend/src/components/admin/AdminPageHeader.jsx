import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * Shared header for every admin page — unifies the title/subtitle/actions row
 * and the optional back link that several pages previously hand-rolled.
 *
 * @param {object}   props
 * @param {React.ComponentType} [props.icon]  lucide icon shown inline before the title
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} [props.actions]   right-aligned node (buttons, etc.)
 * @param {string}   [props.backTo]           if set, renders an ArrowLeft back link above
 * @param {string}   [props.backLabel]
 */
export default function AdminPageHeader({ icon: Icon, title, subtitle, actions, backTo, backLabel }) {
  return (
    <div className="mb-6">
      {backTo && (
        <Link
          to={backTo}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-foreground sm:text-3xl">
            {Icon && <Icon className="h-6 w-6 flex-shrink-0 text-muted-foreground" aria-hidden="true" />}
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  )
}
