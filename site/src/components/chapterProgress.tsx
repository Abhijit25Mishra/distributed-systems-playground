import { CORE_CHAPTERS, SLOW_LANE_CHAPTERS } from '../content/ddia'
import type { Chapter } from '../content/ddia'

/**
 * AGENT-OWNED.
 *
 * The reading schedule, rendered as a ruled list rather than a progress bar.
 * A filled bar would compress fourteen chapters with fourteen different
 * deadlines into one number, which is the least informative summary available.
 * State is carried by a word in every row, so the meaning survives greyscale.
 */

const STATE_LABEL: Record<Chapter['state'], string> = {
  done: 'done',
  reading: 'reading',
  upcoming: '',
}

function ChapterRow({ chapter }: { chapter: Chapter }) {
  return (
    <li className="chapterRow" data-state={chapter.state}>
      <span className="chapterRow__number numeric">{chapter.number}</span>
      <span className="chapterRow__title">{chapter.title}</span>
      <span className="chapterRow__deadline numeric">
        {chapter.state === 'done' ? '' : chapter.deadline}
        {chapter.stretch ? <span className="chapterRow__stretch"> stretch</span> : null}
      </span>
      <span className="chapterRow__state">{STATE_LABEL[chapter.state]}</span>
    </li>
  )
}

export function ChapterProgress() {
  return (
    <section className="section" aria-labelledby="reading-heading">
      <div className="sectionHead">
        <h2 id="reading-heading" className="sectionHead__title">
          Reading schedule
        </h2>
        <p className="sectionHead__note">DDIA, 2nd edition</p>
      </div>

      <ol className="chapterList">
        {CORE_CHAPTERS.map((chapter) => (
          <ChapterRow key={chapter.number} chapter={chapter} />
        ))}
      </ol>

      <p className="chapterList__slow">
        Chapters {SLOW_LANE_CHAPTERS[0]?.number} to{' '}
        {SLOW_LANE_CHAPTERS[SLOW_LANE_CHAPTERS.length - 1]?.number} move to the slow lane through
        2027, alongside the heavier builds.
      </p>
    </section>
  )
}
