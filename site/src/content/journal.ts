import { marked } from 'marked'

/**
 * AGENT-OWNED — journal loading.
 *
 * Entries live in `journal/` at the repo root, outside `site/`, because they
 * are a working artifact of the project rather than website content. The site
 * reads them where they are instead of keeping a second copy, so publishing an
 * entry is just writing it.
 *
 * Vite resolves this glob at build time, so the markdown is inlined into the
 * bundle and no runtime fetch happens. That keeps the site fully static.
 */

const ENTRY_FILENAME = /^(\d{4}-\d{2}-\d{2})\.md$/
const TITLE_LINE = /^#\s+(.+)$/m

const rawEntries = import.meta.glob('../../../journal/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface JournalEntry {
  /** ISO date, also the route segment: /journal/2026-08-15 */
  readonly date: string
  /** Heading text with the leading date stripped. */
  readonly title: string
  /** First paragraph of prose, for the index. */
  readonly excerpt: string
  readonly html: string
}

marked.setOptions({ gfm: true, breaks: false })

function extractTitle(markdown: string, date: string): string {
  const match = TITLE_LINE.exec(markdown)

  if (!match?.[1]) {
    return date
  }

  // Entry headings read "# 2026-08-15 - what happened". The date is already
  // the route and the column heading, so drop it from the title.
  return match[1].replace(/^\d{4}-\d{2}-\d{2}\s*[—–-]\s*/, '').trim()
}

function extractExcerpt(markdown: string): string {
  const body = markdown.replace(TITLE_LINE, '')

  for (const block of body.split(/\n{2,}/)) {
    const text = block.trim()
    const isProse = text !== '' && !text.startsWith('#') && !text.startsWith('|')

    if (isProse) {
      return text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
    }
  }

  return ''
}

function stripTitleHeading(markdown: string): string {
  return markdown.replace(TITLE_LINE, '').trimStart()
}

function buildEntries(): readonly JournalEntry[] {
  const entries: JournalEntry[] = []

  for (const [path, markdown] of Object.entries(rawEntries)) {
    const filename = path.split('/').pop() ?? ''
    const match = ENTRY_FILENAME.exec(filename)

    // journal/README.md documents the format; it is not an entry.
    if (!match?.[1]) {
      continue
    }

    const date = match[1]

    entries.push({
      date,
      title: extractTitle(markdown, date),
      excerpt: extractExcerpt(markdown),
      html: marked.parse(stripTitleHeading(markdown), { async: false }),
    })
  }

  return entries.sort((entryA, entryB) => entryB.date.localeCompare(entryA.date))
}

export const JOURNAL_ENTRIES = buildEntries()

export function findJournalEntry(date: string): JournalEntry | undefined {
  return JOURNAL_ENTRIES.find((entry) => entry.date === date)
}

/** Long-form date for display: "15 August 2026". */
export function formatEntryDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
