import { Link, useParams } from 'react-router-dom'
import { JOURNAL_ENTRIES, findJournalEntry, formatEntryDate } from '../content/journal'
import { NotFoundPage } from './notFoundPage'

/**
 * AGENT-OWNED — journal index and entry.
 *
 * Entries are published as written, mistakes section included. That section is
 * the reason the journal is worth publishing at all: a record of what went
 * wrong and what it cost is harder to fake and more useful to read than a
 * changelog.
 */

export function JournalIndexPage() {
  return (
    <>
      <header className="pageHead">
        <h1 className="pageHead__title">Journal</h1>
        <p className="pageHead__lede">
          Written at the end of a working session. What was done, what the numbers actually said,
          and what was got wrong on the way.
        </p>
      </header>

      {JOURNAL_ENTRIES.length === 0 ? (
        <p className="emptyState">No entries yet.</p>
      ) : (
        <ul className="indexList">
          {JOURNAL_ENTRIES.map((entry) => (
            <li key={entry.date} className="indexRow">
              <Link to={`/journal/${entry.date}`} className="indexRow__link indexRow__link--journal">
                <span className="indexRow__ordinal numeric">
                  <time dateTime={entry.date}>{entry.date}</time>
                </span>
                <span className="indexRow__body">
                  <span className="indexRow__title">{entry.title}</span>
                  <span className="indexRow__summary">{entry.excerpt}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function JournalEntryPage() {
  const { date } = useParams<{ date: string }>()
  const entry = date ? findJournalEntry(date) : undefined

  if (!entry) {
    return <NotFoundPage />
  }

  return (
    <>
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/journal">journal</Link>
        <span aria-hidden="true"> / </span>
        <span className="crumb__current numeric">{entry.date}</span>
      </nav>

      <header className="pageHead">
        <p className="pageHead__ordinal label numeric">
          <time dateTime={entry.date}>{formatEntryDate(entry.date)}</time>
        </p>
        <h1 className="pageHead__title">{entry.title}</h1>
      </header>

      <article className="prose" dangerouslySetInnerHTML={{ __html: entry.html }} />

      <nav className="pager" aria-label="Journal navigation">
        <Link to="/journal" className="pager__link pager__link--prev">
          <span className="label">back to</span>
          <span>All entries</span>
        </Link>
      </nav>
    </>
  )
}
