import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <>
      <header className="pageHead">
        <p className="pageHead__ordinal label numeric">404</p>
        <h1 className="pageHead__title">Nothing at this address</h1>
        <p className="pageHead__lede">
          The page either moved or never existed. The index lists everything that does.
        </p>
      </header>

      <p>
        <Link to="/" className="button">
          Back to the index
        </Link>
      </p>
    </>
  )
}
