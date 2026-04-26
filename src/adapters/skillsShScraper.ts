import type { CatalogEntry } from '@/ontology'
import { fs } from './fs'

interface SkillsShEntry {
  rank: number
  slug: string
  name: string
  repo: string
  installs: number
  installsDisplay: string
}

const SKILLS_SH_URL = 'https://skills.sh'

const parseInstalls = (s: string): number => {
  const trimmed = s.trim()
  if (trimmed.endsWith('M')) return Math.round(parseFloat(trimmed.slice(0, -1)) * 1_000_000)
  if (trimmed.endsWith('K')) return Math.round(parseFloat(trimmed.slice(0, -1)) * 1_000)
  return parseInt(trimmed.replace(/,/g, ''), 10) || 0
}

const ENTRY_RE = new RegExp(
  '<a [^>]*href="/([^/]+/[^/"]+)/([^"]+)"[^>]*>\\s*' +
  '<div[^>]*>\\s*<span[^>]*>(\\d+)</span>\\s*</div>\\s*' +
  '<div[^>]*>\\s*<h3[^>]*>([^<]+)</h3>\\s*' +
  '<p[^>]*>([^<]+)</p>\\s*</div>\\s*' +
  '<div[^>]*>\\s*<span[^>]*>([^<]+)</span>\\s*</div>\\s*' +
  '</a>',
  'gs',
)

const parseHtml = (html: string): SkillsShEntry[] => {
  const entries: SkillsShEntry[] = []
  let m: RegExpExecArray | null
  while ((m = ENTRY_RE.exec(html)) !== null) {
    entries.push({
      rank: parseInt(m[3]!, 10) || entries.length + 1,
      slug: m[2]!.trim(),
      name: m[4]!.trim(),
      repo: m[5]!.trim(),
      installs: parseInstalls(m[6]!),
      installsDisplay: m[6]!.trim(),
    })
  }
  return entries
}

const toCatalogEntry = (e: SkillsShEntry): CatalogEntry => ({
  id: `skillssh:${e.repo}/${e.slug}`,
  type: 'skill',
  name: e.name,
  description: `${e.installsDisplay} installs — ${e.repo}`,
  author: e.repo.split('/')[0] ?? '',
  tags: [e.repo, `#${e.rank}`],
  installData: { repo: e.repo, slug: e.slug },
  installed: false,
})

let cache: CatalogEntry[] | null = null
let fetchPromise: Promise<CatalogEntry[]> | null = null

const fetchHtml = async (): Promise<string> => {
  const result = await fs.runCommand('curl', ['-sL', '--max-time', '10', SKILLS_SH_URL])
  if (result.exit_code !== 0) return ''
  return result.stdout
}

export const fetchSkillsSh = async (): Promise<CatalogEntry[]> => {
  if (cache) return cache
  if (fetchPromise) return fetchPromise

  fetchPromise = (async () => {
    try {
      const html = await fetchHtml()
      if (!html) return []
      const entries = parseHtml(html)
      cache = entries.map(toCatalogEntry)
      return cache
    } catch {
      return []
    } finally {
      fetchPromise = null
    }
  })()
  return fetchPromise
}

export const invalidateSkillsShCache = (): void => {
  cache = null
  fetchPromise = null
}
