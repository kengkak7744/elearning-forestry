import { cloneElement } from 'react'
import { Label } from '@/components/ui/label'

/**
 * Label + input + error/hint wrapper. Wires aria-invalid + aria-describedby
 * onto the child input so screen readers hear "X has an error: <message>"
 * when focused, instead of just reading the label. The describedby points to
 * whichever message is currently visible (error takes precedence over hint).
 */
export default function FormField({ id, label, error, required, children, hint }) {
  const describedById = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const input = cloneElement(children, {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedById,
  })
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && (
          <>
            <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
            <span className="sr-only"> จำเป็น</span>
          </>
        )}
      </Label>
      {input}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
