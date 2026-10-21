// Placeholders still to be filled in, written in page text as
// "[TODO: ...]", "[CONFIRM: ...]" or "[PRICE]". They are shown highlighted,
// so nobody mistakes them for real details. Search the code for "[TODO" /
// "[CONFIRM" / "[PRICE" to find them all.
const MARK = /(\[(?:TODO|CONFIRM|PRICE)[^\]]*\])/

export const hasTodo = (text) => MARK.test(String(text))

// Text with every placeholder wrapped in a highlighted <mark>
export function withTodos(text) {
  const parts = String(text).split(MARK)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 ? (
      <mark key={i} className="sg-todo">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}
