# Prototypes

Weekend-sized (1–2 day) system design prototypes in Go, mostly from
[arpitbbhayani/system-design-questions](https://github.com/arpitbbhayani/system-design-questions)
— e.g. online/offline indicator, SQL-backed KV, distributed cache, airline
check-in, flash sale, SQL-backed message broker.

## Convention

- One subfolder per prototype, self-contained (own `go.mod` if needed).
- Each has its own `README.md`: what it is, the core idea, how to run it,
  and a **demo GIF**.
- Prototypes run locally only — **never hosted**.
- If a run produces an interesting event log, record it to `/logs` using the
  schema in `/logs/schema.md`.
