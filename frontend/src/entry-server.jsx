// Build-time only: renders the home page to plain HTML so search engines and
// link previews see the content without running JavaScript. Used by
// scripts/prerender.js; the browser never loads this file.
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App.jsx'

export { BUSINESS, addressLine } from './business.js'
export { FAQ_GROUPS } from './faqs.js'

export function render(url) {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>,
  )
}
