import { useEffect, useState } from 'react'
import { highlight, highlightCached } from './shiki'

export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string | null>(() => highlightCached(code, lang))

  useEffect(() => {
    if (html) return
    let cancelled = false
    void highlight(code, lang).then((h) => {
      if (!cancelled) setHtml(h)
    })
    return () => {
      cancelled = true
    }
  }, [code, lang, html])

  return (
    <div className="md-code-wrap">
      {lang && <span className="md-code-lang">{lang}</span>}
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="shiki-fallback">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
