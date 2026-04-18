import type { ReactNode } from 'react'
import { create } from 'zustand'
import type { Settings } from '@/ontology'
import { Field } from './Field'
import { Switch } from './Switch'
import { cn } from './util'

interface SettingsDialogState {
  open: boolean
  toggle: () => void
  show: () => void
  close: () => void
}

const useSettingsDialog = create<SettingsDialogState>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}))

export const openSettingsDialog = () => useSettingsDialog.getState().show()

interface Props {
  settings: Settings
  onChange: (next: Settings) => void
  onCheckForUpdates?: () => void
}

export function SettingsDialog({ settings, onChange, onCheckForUpdates }: Props) {
  const { open, close } = useSettingsDialog()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh]"
      onClick={close}
    >
      <div
        className="w-[640px] max-w-[90vw] max-h-[80vh] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="text-sm">Settings</div>
          <button
            onClick={close}
            className="text-zinc-500 hover:text-zinc-100 text-lg leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-auto px-5 py-4 space-y-8">
          <Section title="Editor" description="Defaults for the markdown editor.">
            <Field
              orientation="row"
              label="Markdown default mode"
              hint="Which view to show when opening markdown content."
            >
              <ModeToggle
                value={settings.markdownDefaultMode}
                onChange={(v) => onChange({ ...settings, markdownDefaultMode: v })}
              />
            </Field>
          </Section>
          <Section title="Updates" description="Checks the GitHub release feed, no telemetry.">
            <Field
              orientation="row"
              label="Check for updates on startup"
            >
              <Switch
                value={settings.checkUpdatesOnStartup}
                onChange={(v) => onChange({ ...settings, checkUpdatesOnStartup: v })}
              />
            </Field>
            {onCheckForUpdates && (
              <Field
                orientation="row"
                label="Check now"
                hint="Checks the release feed immediately."
              >
                <button
                  type="button"
                  onClick={onCheckForUpdates}
                  className="text-xs px-3 py-1.5 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-600 text-zinc-100 transition-colors"
                >
                  Check
                </button>
              </Field>
            )}
          </Section>
          {/* Hidden until agentic features actually use the key. Kept in the
              Settings schema so existing config.json files round-trip cleanly.
          <Section title="AI" description="Credentials for upcoming agentic features. Stored locally at ~/.config/ccm/config.json.">
            <Field
              label="Anthropic API Key"
              hint="Reserved for future use. Not currently sent anywhere."
            >
              <SecretInput
                value={settings.anthropic.apiKey}
                onChange={(v) =>
                  onChange({
                    ...settings,
                    anthropic: { ...settings.anthropic, apiKey: v },
                  })
                }
                placeholder="sk-ant-…"
              />
            </Field>
          </Section>
          */}
          <Section title="About">
            <div className="text-xs text-zinc-500 space-y-1 font-mono">
              <div>ccm — Claude Code Manager</div>
              <div>v0.1.0</div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-zinc-100">{title}</h2>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function ModeToggle({
  value,
  onChange,
}: {
  value: 'edit' | 'read'
  onChange: (v: 'edit' | 'read') => void
}) {
  return (
    <div className="inline-flex rounded border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      {(['edit', 'read'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            'text-xs px-3 py-1 capitalize transition-colors',
            value === mode
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-200',
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  )
}

// Paired with the commented-out AI section above. Uncomment both together.
// function SecretInput({
//   value,
//   onChange,
//   placeholder,
// }: {
//   value: string
//   onChange: (v: string) => void
//   placeholder?: string
// }) {
//   const [show, setShow] = useState(false)
//   const [local, setLocal] = useState(value)
//
//   const commit = () => {
//     if (local !== value) onChange(local)
//   }
//
//   return (
//     <div className="flex gap-2 items-center">
//       <input
//         type={show ? 'text' : 'password'}
//         value={local}
//         placeholder={placeholder}
//         onChange={(e) => setLocal(e.target.value)}
//         onBlur={commit}
//         className={cn(
//           'flex-1 bg-zinc-900/40 hover:bg-zinc-900/80 focus:bg-zinc-900 rounded px-2 py-1',
//           'border border-dashed border-zinc-800 hover:border-zinc-700 focus:border-orange-400 focus:border-solid',
//           'outline-none transition-colors font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600',
//         )}
//       />
//       <button
//         type="button"
//         onClick={() => setShow((s) => !s)}
//         className="text-xs text-zinc-500 hover:text-zinc-100 px-2 py-1"
//       >
//         {show ? 'hide' : 'show'}
//       </button>
//     </div>
//   )
// }
