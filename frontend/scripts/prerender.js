// Runs after `vite build` (see "build" in package.json). It:
// - keeps the empty app shell as dist/app.html (served for /admin and
//   unknown paths, see netlify.toml)
// - fills dist/index.html with the rendered home page, plus the tags search
//   engines and link previews read: canonical URL, Open Graph, and
//   structured data (business details and FAQs)
// - renders the legal pages (privacy, terms, cancellation) to
//   dist/<name>.html, each with its own title, description and canonical URL
// - renders the service pages (e.g. /kochi-airport-car-rental) to
//   dist/<path>/index.html, with their own tags and structured data
//   (breadcrumbs, FAQs, the service)
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

const { render, BUSINESS, addressLine, FAQ_GROUPS, LEGAL_LIST, AIRPORT_FAQS, AIRPORT_META, AIRPORT_PATH } = await import(
  pathToFileURL(ssrEntry).href
)

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

function faqData(items = FAQ_GROUPS.flatMap((g) => g.items)) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

// Canonical URL plus the Open Graph / Twitter tags link previews read
function socialTags({ title, description, path }) {
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeAttr(BUSINESS.name)}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
  ]
  if (siteUrl) {
    tags.unshift(`<link rel="canonical" href="${siteUrl}${path}" />`)
    tags.push(
      `<meta property="og:url" content="${siteUrl}${path}" />`,
      `<meta property="og:image" content="${siteUrl}${SHARE_IMAGE}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="A car driving down an open road at sunset" />`,
      `<meta name="twitter:image" content="${siteUrl}${SHARE_IMAGE}" />`,
      `<meta name="twitter:image:alt" content="A car driving down an open road at sunset" />`,
    )
  }
  return tags
}

const indent = (tags) => tags.map((t) => `    ${t}`).join('\n')

function headTags() {
  const tags = socialTags({ title: TITLE, description: BUSINESS.description, path: '/' })
  tags.push(jsonLd(businessData()), jsonLd(faqData()))
  return indent(tags)
}

// Cochin Airport page: breadcrumbs, the rental service and its FAQs
function airportTags() {
  const url = siteUrl ? `${siteUrl}${AIRPORT_PATH}` : ''
  const tags = socialTags({ title: AIRPORT_META.title, description: AIRPORT_META.description, path: AIRPORT_PATH })
  if (siteUrl) {
    tags.push(
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: AIRPORT_META.breadcrumb, item: url },
        ],
      }),
    )
  }
  tags.push(
    jsonLd(
      clean({
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Self-drive car rental at Cochin International Airport',
        serviceType: 'Self-drive car rental',
        url,
        description: AIRPORT_META.description,
        provider: {
          '@type': 'AutoRental',
          '@id': siteUrl ? `${siteUrl}/#business` : '',
          name: BUSINESS.name,
          legalName: BUSINESS.legalName,
          telephone: BUSINESS.phone,
          email: BUSINESS.email,
          url: siteUrl ? `${siteUrl}/` : '',
          parentOrganization: { '@type': 'Organization', name: 'AVS Rent A Car' },
        },
        areaServed: [
          { '@type': 'Airport', name: 'Cochin International Airport', iataCode: 'COK' },
          { '@type': 'Place', name: 'Nedumbassery' },
          { '@type': 'City', name: 'Kochi' },
        ],
      }),
    ),
    jsonLd(faqData(AIRPORT_FAQS)),
  )
  return indent(tags)
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

// Legal pages: their own title / description / canonical, and no hero
// image preload (only the home page shows it)
for (const p of LEGAL_LIST) {
  const title = `${p.title} | Drive Kochi`
  const html = shell
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escapeAttr(p.description)}$2`)
    .replace(/\s*<link rel="preload" as="image" href="\/images\/hero.webp" \/>/, '')
    .replace(
      '</head>',
      `${siteUrl ? `  <link rel="canonical" href="${siteUrl}${p.path}" />\n  ` : ''}  <meta property="og:title" content="${escapeAttr(title)}" />\n  </head>`,
    )
    .replace('<div id="root"></div>', `<div id="root">${render(p.path)}</div>`)
  fs.writeFileSync(path.join(dist, `${p.path.slice(1)}.html`), html)
}

// Service pages: their own title / description / tags, saved as
// <path>/index.html so the address works without ".html"
const SERVICE_PAGES = [
  { path: AIRPORT_PATH, title: AIRPORT_META.title, description: AIRPORT_META.description, tags: airportTags },
]
for (const p of SERVICE_PAGES) {
  const html = shell
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(p.title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escapeAttr(p.description)}$2`)
    .replace('</head>', `${p.tags().trimStart()}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${render(p.path)}</div>`)
  const dir = path.join(dist, p.path.slice(1))
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html)
}

const sitemapUrls = ['/', ...SERVICE_PAGES.map((p) => p.path), ...LEGAL_LIST.map((p) => p.path)]

if (siteUrl) {
  fs.writeFileSync(
    path.join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (u) => `  <url>
    <loc>${siteUrl}${u}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>
`,
  )
  fs.appendFileSync(path.join(dist, 'robots.txt'), `\nSitemap: ${siteUrl}/sitemap.xml\n`)
}

console.log(`prerender: home page, ${SERVICE_PAGES.length} service and ${LEGAL_LIST.length} legal pages rendered${siteUrl ? ` for ${siteUrl}` : ''}`)
if (!siteUrl) console.warn('prerender: no SITE_URL / URL set, so no canonical URL, share image or sitemap')
if (!addressLine()) console.warn('prerender: no street address in src/business.js yet')

// Some modules keep handles open (e.g. a BroadcastChannel); the work is done
process.exit(0)
