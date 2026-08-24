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

for (const [path, markdown] of Object.entries(rawWriteups)) {
  const slug = path.split('/').pop()?.replace(/\.md$/, '')

  if (slug) {
    writeups.set(slug, marked.parse(markdown, { async: false }))
  }
}

export function findWriteup(slug: string): string | undefined {
  return writeups.get(slug)
}
