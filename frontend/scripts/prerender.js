// Runs after `vite build` (see "build" in package.json). It:
// - keeps the empty app shell as dist/app.html (served for /admin and
//   unknown paths, see netlify.toml)
// - fills dist/index.html with the rendered home page, plus the tags search
//   engines and link previews read: canonical URL, Open Graph, and
//   structured data (business details and FAQs)
// - writes dist/sitemap.xml and points robots.txt at it
//
// The site address comes from SITE_URL, or from URL, which Netlify sets
// during builds to the site's main address.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const ssrEntry = path.join(root, 'dist-ssr', 'entry-server.js')

const { render, BUSINESS, addressLine, FAQ_GROUPS } = await import(pathToFileURL(ssrEntry).href)

const siteUrl = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '')
const TITLE = 'Drive Kochi | Self-drive car rental in Kochi (Cochin)'
const SHARE_IMAGE = '/images/share.jpg'

const DAY_NAMES = { Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' }

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
// JSON inside <script>: "<" escaped so text can never close the tag
const jsonLd = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

// Drop empty strings, empty arrays and nulls so unfilled details are left out
function clean(value) {
  if (Array.isArray(value)) {
    const list = value.map(clean).filter((v) => v !== undefined)
    return list.length ? list : undefined
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([k, v]) => [k, clean(v)])
      .filter(([, v]) => v !== undefined)
    return entries.length ? Object.fromEntries(entries) : undefined
  }
  return value === '' || value === null ? undefined : value
}

function businessData() {
  const b = BUSINESS
  return clean({
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    '@id': siteUrl ? `${siteUrl}/#business` : '',
    name: b.name,
    legalName: b.legalName,
    description: b.description,
    url: siteUrl ? `${siteUrl}/` : '',
    image: siteUrl ? `${siteUrl}${SHARE_IMAGE}` : '',
    logo: siteUrl ? `${siteUrl}/apple-touch-icon.png` : '',
    telephone: b.phone,
    email: b.email,
    priceRange: b.priceRange,
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.address.street,
      addressLocality: b.address.locality,
      addressRegion: b.address.region,
      postalCode: b.address.postalCode,
      addressCountry: b.address.country,
    },
    geo: b.geo ? { '@type': 'GeoCoordinates', latitude: b.geo.lat, longitude: b.geo.lng } : null,
    hasMap: b.mapUrl,
    openingHoursSpecification: b.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days.map((d) => DAY_NAMES[d] || d),
      opens: h.opens,
      closes: h.closes,
    })),
    areaServed: b.areaServed.map((name) => ({ '@type': 'City', name })),
    sameAs: b.sameAs,
  })
}

function faqData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_GROUPS.flatMap((g) => g.items).map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

function headTags() {
  const description = BUSINESS.description
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeAttr(BUSINESS.name)}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:title" content="${escapeAttr(TITLE)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(TITLE)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
  ]
  if (siteUrl) {
    tags.unshift(`<link rel="canonical" href="${siteUrl}/" />`)
    tags.push(
      `<meta property="og:url" content="${siteUrl}/" />`,
      `<meta property="og:image" content="${siteUrl}${SHARE_IMAGE}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="A car driving down an open road at sunset" />`,
      `<meta name="twitter:image" content="${siteUrl}${SHARE_IMAGE}" />`,
    )
  }
  tags.push(jsonLd(businessData()), jsonLd(faqData()))
  return tags.map((t) => `    ${t}`).join('\n')
}

const shell = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
if (!shell.includes('<div id="root"></div>')) throw new Error('prerender: <div id="root"></div> not found in dist/index.html')

// Admin pages and unknown paths get the empty shell, so they never flash
// the home page before the app loads
fs.writeFileSync(path.join(dist, 'app.html'), shell)

const page = shell
  .replace('</head>', `${headTags().trimStart()}\n  </head>`)
  .replace('<div id="root"></div>', `<div id="root">${render('/')}</div>`)
fs.writeFileSync(path.join(dist, 'index.html'), page)

if (siteUrl) {
  fs.writeFileSync(
    path.join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </url>
</urlset>
`,
  )
  fs.appendFileSync(path.join(dist, 'robots.txt'), `\nSitemap: ${siteUrl}/sitemap.xml\n`)
}

console.log(`prerender: home page rendered${siteUrl ? ` for ${siteUrl}` : ''}`)
if (!siteUrl) console.warn('prerender: no SITE_URL / URL set, so no canonical URL, share image or sitemap')
if (!addressLine()) console.warn('prerender: no street address in src/business.js yet')

// Some modules keep handles open (e.g. a BroadcastChannel); the work is done
process.exit(0)
