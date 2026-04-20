import { codeToHtml } from 'shiki'

const cache = new Map<string, string>()
const CACHE_LIMIT = 200
const THEME = 'one-dark-pro'

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ??
      c,
  )

const plainFallback = (code: string): string =>
  `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`

const keyOf = (code: string, lang: string): string => `${lang}\u0000${code}`

export const highlightCached = (code: string, lang: string): string | null =>
  cache.get(keyOf(code, lang)) ?? null

export const highlight = async (code: string, lang: string): Promise<string> => {
  const key = keyOf(code, lang)
  const hit = cache.get(key)
  if (hit) return hit
  try {
    const html = await codeToHtml(code, { lang: lang || 'text', theme: THEME })
    if (cache.size >= CACHE_LIMIT) {
      const first = cache.keys().next().value
      if (first !== undefined) cache.delete(first)
    }
    cache.set(key, html)
    return html
  } catch {
    try {
      const html = await codeToHtml(code, { lang: 'text', theme: THEME })
      cache.set(key, html)
      return html
    } catch {
      return plainFallback(code)
    }
  }
}
