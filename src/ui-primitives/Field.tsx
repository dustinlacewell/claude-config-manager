import type { ReactNode } from 'react'
import { cn } from './util'

interface Props {
  label: string
  hint?: string
  error?: string
  /**
   * `column` (default) — tiny uppercase label above the control; use for any
   * control that wants horizontal space (text inputs, textareas, array
   * editors, markdown).
   * `row` — regular-weight label on the left, control on the right; use only
   * for compact controls that don't stretch (Switch, short enum button group).
   */
  orientation?: 'column' | 'row'
  children: ReactNode
}

export function Field({ label, hint, error, orientation = 'column', children }: Props) {
  if (orientation === 'row') {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-zinc-200">{label}</div>
          {hint && !error && (
            <div className="text-xs text-zinc-500 mt-0.5">{hint}</div>
          )}
          {error && <div className="text-xs text-red-400 mt-0.5">{error}</div>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <label className={cn('block text-[11px] uppercase tracking-wide text-zinc-500')}>
        {label}
      </label>
      {children}
      {hint && !error && <div className="text-xs text-zinc-600">{hint}</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  )
}
