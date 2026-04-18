import { Plugin, emptyPlugin, pluginKey } from '@/ontology'
import { Field, Switch } from '@/ui-primitives'
import type { UiDescriptor } from './types'

const ReadOnlyText = ({ value, mono = false }: { value: string; mono?: boolean }) => (
  <div className={`text-sm text-zinc-300 ${mono ? 'font-mono break-all' : 'whitespace-pre-wrap'}`}>
    {value}
  </div>
)

export const pluginDescriptor: UiDescriptor<Plugin> = {
  kind: 'plugin',
  newLabel: 'Add Plugin',
  newPromptLabel: 'Plugin name',
  newDefault: (name) => emptyPlugin(name),
  listLabel: (v) => pluginKey(v),
  listSublabel: (v) => `${v.version || '—'}${v.enabled ? ' · enabled' : ''}`,
  headerSubtitle: (v) => `v${v.version || '—'} · ${v.scope}`,
  Editor: ({ value, onChange }) => (
    <>
      <div className="pb-2 border-b border-zinc-800">
        <Field orientation="row" label="Enabled">
          <Switch
            value={value.enabled}
            onChange={(next) => onChange({ ...value, enabled: next })}
          />
        </Field>
      </div>

      {value.installPath && (
        <Field label="Install Path">
          <ReadOnlyText value={value.installPath} mono />
        </Field>
      )}

      {value.manifestFound ? (
        <>
          {value.description && (
            <Field label="Description">
              <ReadOnlyText value={value.description} />
            </Field>
          )}
          {value.author?.name && (
            <Field label="Author">
              <ReadOnlyText
                value={
                  value.author.url
                    ? `${value.author.name} (${value.author.url})`
                    : value.author.name
                }
              />
            </Field>
          )}
          {value.repository && (
            <Field label="Repository">
              <ReadOnlyText value={value.repository} mono />
            </Field>
          )}
          {value.homepage && (
            <Field label="Homepage">
              <ReadOnlyText value={value.homepage} mono />
            </Field>
          )}
          {value.keywords.length > 0 && (
            <Field label="Keywords">
              <div className="flex flex-wrap gap-1">
                {value.keywords.map((k) => (
                  <span
                    key={k}
                    className="inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </Field>
          )}
          {value.license && (
            <Field label="License">
              <ReadOnlyText value={value.license} />
            </Field>
          )}
        </>
      ) : (
        value.installPath && (
          <Field label="Manifest">
            <div className="text-xs text-amber-500">
              No plugin.json found at the install path.
            </div>
          </Field>
        )
      )}

      {(value.installedAt || value.lastUpdated) && (
        <Field label="Timestamps">
          <div className="text-xs text-zinc-500">
            {value.installedAt && <div>Installed: {value.installedAt}</div>}
            {value.lastUpdated && <div>Updated: {value.lastUpdated}</div>}
          </div>
        </Field>
      )}
    </>
  ),
}
