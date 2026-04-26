import { useEffect, useRef } from 'react'
import { create } from 'zustand'

interface ConfirmRequest {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  resolve: (v: boolean) => void
}

interface ConfirmStore {
  current: ConfirmRequest | null
  open: (r: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>
  close: (v: boolean) => void
}

const useConfirmStore = create<ConfirmStore>((set, get) => ({
  current: null,
  open: (r) =>
    new Promise((resolve) => {
      set({ current: { ...r, resolve } })
    }),
  close: (v) => {
    const r = get().current
    if (r) r.resolve(v)
    set({ current: null })
  },
}))

export const confirm = (opts: {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}): Promise<boolean> => useConfirmStore.getState().open(opts)

export function ConfirmHost() {
  const current = useConfirmStore((s) => s.current)
  const close = useConfirmStore((s) => s.close)
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (current) setTimeout(() => confirmBtnRef.current?.focus(), 0)
  }, [current])

  if (!current) return null

  const accent = current.danger
    ? 'bg-red-500 text-zinc-950 hover:bg-red-400'
    : 'bg-orange-500 text-zinc-950 hover:bg-orange-400'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[20vh]"
      onClick={() => close(false)}
    >
      <div
        className="w-[460px] max-w-[90vw] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') close(true)
          if (e.key === 'Escape') close(false)
        }}
      >
        <div className="px-4 py-3 border-b border-zinc-800 text-sm">
          {current.title}
        </div>
        {current.body && (
          <div className="px-4 py-3 text-sm text-zinc-400 whitespace-pre-wrap break-words">
            {current.body}
          </div>
        )}
        <div className="px-4 py-3 border-t border-zinc-800 flex justify-end gap-2">
          <button
            onClick={() => close(false)}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100"
          >
            {current.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={() => close(true)}
            className={`px-3 py-1.5 text-sm rounded ${accent}`}
          >
            {current.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
