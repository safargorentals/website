import { withTodos } from './Todo.jsx'

const pad = (n) => String(n).padStart(2, '0')

// FAQ accordion, numbered across all groups. groups: [{ title, items:
// [{ q, a }] }]; a group without a title gets no heading. firstOpen: the
// first question starts open.
export default function FaqList({ groups, firstOpen = false }) {
  return (
    <div className="sg-faq__list">
      {groups.map((g, gi) => {
        const offset = groups.slice(0, gi).reduce((n, prev) => n + prev.items.length, 0)
        return (
          <div key={g.title || gi} className="sg-faq__group">
            {g.title && <h3 className="reveal">{g.title}</h3>}
            {g.items.map((f, i) => (
              <details key={f.q} className="reveal" style={{ '--i': i }} open={firstOpen && offset + i === 0}>
                <summary>
                  <span>{pad(offset + i + 1)}</span>
                  {f.q}
                  <i aria-hidden="true" />
                </summary>
                <p>{withTodos(f.a)}</p>
              </details>
            ))}
          </div>
        )
      })}
    </div>
  )
}
