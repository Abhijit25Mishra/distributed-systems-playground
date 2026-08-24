import { marked } from 'marked'

/**
 * AGENT-OWNED — per-visualization write-ups.
 *
 * A write-up is `site/src/content/writeups/<slug>.md`. The folder does not
 * exist yet and should not be created empty: it appears with the first
 * write-up, in the same change. Vite resolves a glob over a missing directory
 * to an empty object, so this is safe until then.
 *
 * The write-up is the part that makes a visualization mean something a year
 * later. The figure shows what happens; the write-up says why it matters and
 * what the design doc got wrong on the way there.
 */

const rawWriteups = import.meta.glob('./writeups/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const writeups = new Map<string, string>()

/**
 * Tables get a scroll container.
 *
 * `.prose table` carries a 32rem min-width, because a data table squeezed onto
 * a phone stops being readable before it stops fitting. Left bare that makes
 * the *page* scroll sideways, which is the one thing the layout rules forbid
 * outright. Marked emits a plain `<table>`, so the wrapper is added here once
 * rather than being remembered in every write-up.
 */
function wrapTables(html: string): string {
  return html
    .replace(/<table>/g, '<div class="tableWrap"><table>')
    .replace(/<\/table>/g, '</table></div>')
}

for (const [path, markdown] of Object.entries(rawWriteups)) {
  const slug = path.split('/').pop()?.replace(/\.md$/, '')

  if (slug) {
    writeups.set(slug, wrapTables(marked.parse(markdown, { async: false })))
  }
}

export function findWriteup(slug: string): string | undefined {
  return writeups.get(slug)
}
