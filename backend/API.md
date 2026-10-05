# Drive Kochi API

Base URL (local): `http://localhost:3000`

All responses are JSON. Car objects always use this shape (camelCase,
`pricePerDay` is a number):

```json
{
  "id": 4,
  "name": "Toyota Fortuner",
  "brand": "Toyota",
  "type": "suv",
  "seats": 7,
  "transmission": "automatic",
  "fuel": "diesel",
  "pricePerDay": 18000,
  "currency": "INR",
  "images": ["https://placehold.co/800x500?text=Toyota+Fortuner"],
  "description": "Rugged 7-seater SUV for long journeys and rough roads.",
  "isFeatured": true,
  "isAvailable": true
}
```

## Cars

### GET /api/cars

List cars. All query params are optional:

| Param | Type | Default | Notes |
|---|---|---|---|
| type | string | - | e.g. `sedan`, `suv`, `hatchback` |
| brand | string | - | e.g. `Toyota` |
| transmission | string | - | e.g. `automatic` |
| fuel | string | - | e.g. `petrol`, `diesel` |
| search | string | - | partial match on car name |
| page | int | 1 | 1-based page number |
| limit | int | 12 | results per page, max 50 |

Example: `GET /api/cars?type=suv&limit=10`

```json
{
  "data": [
    {
      "id": 4,
      "name": "Toyota Fortuner",
      "brand": "Toyota",
      "type": "suv",
      "seats": 7,
      "transmission": "automatic",
      "fuel": "diesel",
      "pricePerDay": 18000,
      "currency": "INR",
      "images": ["https://placehold.co/800x500?text=Toyota+Fortuner"],
      "description": "Rugged 7-seater SUV for long journeys and rough roads.",
      "isFeatured": true,
      "isAvailable": true
    }
  ],
  "page": 1,
  "totalPages": 1
}
```

### GET /api/cars/featured

Featured cars only, in `featured_order` sequence.

```json
{
  "data": [
    { "id": 1, "name": "Toyota Corolla", "...": "..." },
    { "id": 4, "name": "Toyota Fortuner", "...": "..." }
  ]
}
```

### GET /api/cars/:id

One car by id. `:id` must be a positive integer.

`GET /api/cars/1` -> 200

```json
{
  "id": 1,
  "name": "Toyota Corolla",
  "brand": "Toyota",
  "type": "sedan",
  "seats": 5,
  "transmission": "automatic",
  "fuel": "petrol",
  "pricePerDay": 6500,
  "currency": "INR",
  "images": ["https://placehold.co/800x500?text=Toyota+Corolla"],
  "description": "Comfortable, fuel-efficient sedan - a favourite for city and highway trips.",
  "isFeatured": true,
  "isAvailable": true
}
```

`GET /api/cars/999` -> 404

```json
{ "error": "Car not found" }
```

## Car types

### GET /api/car-types

The categories shown on the site, in display order. `value` is what cars
store in `type` and what `GET /api/cars?type=` filters by.

```json
{ "data": [{ "value": "suv", "label": "SUV", "blurb": "Room for family and luggage", "image": "/images/suv.webp" }] }
```

## Locations

### GET /api/locations

Pickup / drop-off places, in display order. The site shows them as
`name (tag)` in the search box and booking form, and in the scrolling band.

```json
{ "data": [{ "id": 1, "name": "Kochi Airport", "tag": "pickup" }] }
```

## Enquiries

### POST /api/enquiries

Submit a rental enquiry. No login needed.

- Rate limited to **5 per hour per IP** - more than that returns 429.
- The JSON body must be at most **10 KB**.

Required: `name`, `phone`, `pickupLocation`, `dropoffLocation`, `startDate`, `endDate`, `pickupTime`, `dropoffTime`.
Optional: `email`, `carId` (must be an existing car), `message` (max 1000 chars).
`website` is a hidden honeypot field - always send it as an empty string.

Example request:

```json
{
  "name": "Ali Raza",
  "phone": "+91 98765 43210",
  "email": "ali@example.com",
  "carId": 1,
  "pickupLocation": "Kochi",
  "dropoffLocation": "Thrissur",
  "startDate": "2026-10-10",
  "endDate": "2026-10-13",
  "pickupTime": "10:00",
  "dropoffTime": "18:00",
  "message": "Need a car for a family trip",
  "website": ""
}
```

Success -> 201

```json
{ "id": 42, "message": "Enquiry received" }
```

Invalid input -> 400, with the invalid field(s) listed:

```json
{ "error": "Validation failed", "fields": { "phone": "Phone may only contain digits, spaces and + - ( )" } }
```

Too many submissions in an hour -> 429

```json
{ "error": "Too many enquiries. Please try again in an hour." }
```

## Admin authentication

The admin session lives in an `httpOnly` cookie named `admin_token`
(a JWT inside, valid 8 hours). The token is **never** returned in a
JSON body. Cookie settings (`secure`, `sameSite`) come from the
environment: `COOKIE_SECURE`, `COOKIE_SAME_SITE`.

### Create the first admin

```bash
npm run admin:create
```

Asks for an email and a password in the terminal (the password is typed
hidden and must be at least 12 characters). Refuses duplicate emails.

### Change an admin password

```bash
npm run admin:change-password
```

Asks for the admin's email, then the new password twice (typed hidden,
minimum 12 characters, the two entries must match). If the email is not
an admin account the script fails clearly and changes nothing. The
password is never shown or logged.

### POST /api/admin/login

```json
{ "email": "admin@safargo.test", "password": "your-password" }
```

- `200` -> `{ "ok": true }` (plus the `admin_token` cookie, httpOnly)
- `400` -> validation (bad email, empty or >200 char password)
- `401` -> `{ "error": "Invalid email or password" }` - the same message
  for unknown email and wrong password, and with identical timing
- `429` -> after 5 failed attempts in 15 minutes:
  `{ "error": "Too many login attempts. Please try again in 15 minutes." }`

### POST /api/admin/logout

Requires a valid session. Clears the `admin_token` cookie.

```json
{ "ok": true }
```

### GET /api/admin/me

Requires a valid session.

```json
{ "ok": true, "email": "admin@safargo.test" }
```

Without a valid session:

```json
{ "error": "Unauthorized" }
```

## Admin dashboard

Requires an admin session (no cookie -> `401 {"error":"Unauthorized"}`).

### GET /api/admin/stats

Live counts for the dashboard - five integers, no query params:

```json
{
  "newEnquiries": 3,
  "totalEnquiries": 6,
  "totalCars": 10,
  "availableCars": 7,
  "featuredCars": 2
}
```

(`newEnquiries` = enquiries still with status `new`; for per-status
breakdowns use `GET /api/admin/enquiries/stats`.)

## Admin car management

All routes start with `/api/admin/cars` and require an admin session
(no cookie -> `401 {"error":"Unauthorized"}`).

Admin car objects use the public shape PLUS the internal fields
`featuredOrder`, `createdAt` and `updatedAt`.

### GET /api/admin/cars

Query params: `page` (default 1), `limit` (default 20, max 100).
Lists ALL cars, including unavailable ones. Same `{ data, page, totalPages }`
shape as the public list.

### GET /api/admin/cars/:id

One car with admin fields. Unknown id -> `404 {"error":"Car not found"}`.

### POST /api/admin/cars

Create a car -> `201` with the created car (admin shape).

Required: `name` (2-100 chars), `brand` (2-50), `type` (the `value` of
an existing car type, see GET /api/car-types; unknown types get
`fields.type: "Unknown car type"`), `seats` (1-20),
`transmission` (`manual`|`automatic`), `fuel`
(`petrol`|`diesel`|`hybrid`|`electric`|`cng`), `pricePerDay` (0-1000000).

Optional: `currency` (3 uppercase letters, default `"INR"`), `images`
(max 10, each must start with `https://`, default `[]`), `description`
(max 2000 chars), `isAvailable` (default `true`).
(There is no `isFeatured` here - featuring is a separate PATCH below.)

Example request:

```json
{
  "name": "Isuzu D-Max",
  "brand": "Isuzu",
  "type": "pickup",
  "seats": 5,
  "transmission": "manual",
  "fuel": "diesel",
  "pricePerDay": 12000,
  "currency": "INR",
  "images": ["https://placehold.co/800x500?text=Isuzu+D-Max"],
  "description": "Tough work pickup",
  "isAvailable": true
}
```

### PUT /api/admin/cars/:id

Partial update: only the fields you send change, validated with the same
rules as create. **Unknown fields (id, created_at, ...) are rejected:**

```json
{ "error": "Validation failed", "fields": { "id": "Unrecognized keys: \"id\"", "bogus": "Unrecognized keys: \"bogus\"" } }
```

### PATCH /api/admin/cars/:id/price

```json
{ "pricePerDay": 9500 }
```

`pricePerDay` must be a number 0-1000000.

### PATCH /api/admin/cars/:id/featured

```json
{ "isFeatured": true, "featuredOrder": 2 }
```

`featuredOrder` is optional (integer 1-100). Setting `isFeatured: false`
always clears `featuredOrder`.
Note: featured cars without an order sort first (PostgreSQL puts NULL first).

### DELETE /api/admin/cars/:id

```json
{ "ok": true }
```

Unknown id -> `404 {"error":"Car not found"}`.
Enquiries linked to the car are kept; the database sets their `car_id` to NULL.

All invalid input -> `400 {"error":"Validation failed","fields":{...}}`.

## Admin car types

All routes start with `/api/admin/car-types` and require an admin session.
The admin shape adds `sortOrder` and `carCount` (cars using the type).
`image` is an `https://` link or a bundled `/images/...` stock photo.

### GET /api/admin/car-types

Every type with its car count -> `{ "data": [...] }`.

### POST /api/admin/car-types

Body `{ "label": "Mini Van", "blurb"?: "...", "image"?: "https://..." }`
-> `201`. The `value` is made from the label (`"mini-van"`) and never
changes afterwards. A label that gives an existing value -> `409`.

### PUT /api/admin/car-types/:value

Change `label`, `blurb` and/or `image` (null clears blurb/image).

### PUT /api/admin/car-types/order

Body `{ "slugs": ["suv", "sedan", ...] }` listing every type exactly once,
in the new order -> the reordered list.

### DELETE /api/admin/car-types/:value

`200 { "ok": true }`, or `409` while any car still uses the type.

## Admin locations

All routes start with `/api/admin/locations` and require an admin session.
Names are unique (ignoring case) -> duplicates get `409`. Enquiries store
the chosen name as text, so editing or deleting a location never changes
past enquiries.

- `GET /api/admin/locations` -> `{ "data": [...] }`
- `POST /api/admin/locations` - body `{ "name": "Aluva Metro", "tag"?: "pickup" }` -> `201`
- `PUT /api/admin/locations/:id` - change `name` and/or `tag` (`""` or null clears the tag)
- `PUT /api/admin/locations/order` - body `{ "ids": [3, 1, 2, ...] }`, every location once
- `DELETE /api/admin/locations/:id` -> `{ "ok": true }`

## Admin image uploads

### POST /api/admin/uploads

Admin session required. Rate limited to 30 requests per 15 minutes.

Send `multipart/form-data` with field name `images`: up to 5 files,
max 5 MB each, JPEG/PNG/WebP only. Files are checked by their real
content (magic bytes), not just the extension, and are never written to
disk. Each file goes to the `safargo/cars` folder on Cloudinary with
automatic quality/format optimization and a random file name.

Example:

```bash
curl -X POST http://localhost:3000/api/admin/uploads -b cookies.txt \
  -F "images=@photo1.jpg" -F "images=@photo2.png"
```

Success -> 200

```json
{ "urls": ["https://res.cloudinary.com/<cloud>/image/upload/safargo/cars/<random>.jpg"] }
```

Wrong file type, oversized file, too many files, or wrong field name ->
clean `400`/`413` JSON, never a stack trace:

```json
{ "error": "File too large (max 5 MB per image)" }
```

### Frontend note

Upload FIRST, then paste the returned URLs into the car create/update
body (`images` array, max 10 per car). The car endpoints accept any
`https://` image link, so pasted links work too.

## Admin enquiry management

All routes start with `/api/admin/enquiries` and require an admin session
(no cookie -> `401 {"error":"Unauthorized"}`).

### GET /api/admin/enquiries

Newest first. Optional query params: `status`
(`new`|`contacted`|`confirmed`|`closed`), `search` (matches name, phone or
email, case-insensitive), `carId`, `from`/`to` (filter by created date,
`YYYY-MM-DD`, both ends inclusive), `page` (default 1), `limit`
(default 20, max 100).

```json
{
  "data": [
    {
      "id": 1,
      "name": "Ali Raza",
      "phone": "+91 98765 43210",
      "email": "ali@example.com",
      "carId": 1,
      "carName": "Toyota Corolla",
      "pickupLocation": "Kochi",
      "dropoffLocation": "Thrissur",
      "startDate": "2026-10-10",
      "endDate": "2026-10-13",
      "pickupTime": "10:00",
      "dropoffTime": "18:00",
      "message": "Need a car for a family trip",
      "status": "new",
      "notes": null,
      "createdAt": "2026-10-03T10:00:00.000Z"
    }
  ],
  "page": 1,
  "totalPages": 1,
  "total": 1
}
```

### GET /api/admin/enquiries/:id

One enquiry with full details. Unknown id -> `404 {"error":"Enquiry not found"}`.

### GET /api/admin/enquiries/stats

Dashboard counts (always all five keys, zeroes included):

```json
{ "new": 3, "contacted": 1, "confirmed": 0, "closed": 2, "total": 6 }
```

### PATCH /api/admin/enquiries/:id

Only `status` and `notes` may change - anything else (name, phone, ...)
is rejected with 400. `notes` is trimmed, max 2000 chars.

```json
{ "status": "contacted", "notes": "Called the customer" }
```

Returns the updated enquiry in the same shape as above.

### DELETE /api/admin/enquiries/:id

```json
{ "ok": true }
```

Unknown id -> `404 {"error":"Enquiry not found"}`.

### Frontend note

Enquiry objects always use camelCase (`pickupLocation`, `startDate`,
`createdAt`, ...). Dates are plain `YYYY-MM-DD` and times are `HH:MM`,
except `createdAt` which is a full ISO timestamp. `carName` (and `carId`)
are `null` when the car was deleted - show something like "Car removed"
in that case. The dashboard can call `/stats` for the status cards and the
list endpoint for the table.

All invalid input -> `400 {"error":"Validation failed","fields":{...}}`.

## CORS

The API only answers cross-origin browser requests whose `Origin` exactly
matches one of the origins in `FRONTEND_URL`, which may list one or
several origins separated by commas:

```
FRONTEND_URL=http://localhost:5173,https://safargo.com
```

- Only those exact origins ever receive an
  `Access-Control-Allow-Origin` header (echoed back as-is, **never `*`**).
  Any other origin - or a request with no Origin - gets no CORS headers
  at all, so the browser blocks it.
- `Access-Control-Allow-Credentials: true` is sent for allowed origins.
- Allowed methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
- Allowed headers: `Content-Type`.

**Frontend note:** the admin session rides on the httpOnly `admin_token`
cookie, so the frontend MUST send credentials with every API call, e.g.

```js
fetch('/api/admin/me', { credentials: 'include' })
```

(set `credentials: 'include'` once on your axios instance or fetch wrapper).
Without it the browser will not attach the cookie on cross-origin
requests and the admin will appear logged out.

## Request logging (production)

With `NODE_ENV=production` every request logs one line:
`METHOD /path STATUS time_ms`, where the path has no query string.
Request bodies, cookies, headers and query strings are never logged.
Development logs nothing.

## Security rules for API clients

- Every admin request that changes something (POST, PUT, PATCH, DELETE,
  including login and logout) must send the header
  `X-Requested-With: XMLHttpRequest`, or it gets `403`. This blocks
  cross-site request forgery; the website's fetch helper adds it.
- Admin responses carry `Cache-Control: no-store`.
- Logout ends the session on the server: the old cookie stops working
  everywhere, not just in that browser. Changing the password does the same.
- When `NETLIFY_PROXY_SECRET` is set, only requests forwarded (and signed)
  by the Netlify site are answered; everything else gets `403` except
  `GET /api/health`.

### Rate limits (per 15 minutes unless noted)

| What | Limit | Counted per |
| --- | --- | --- |
| Public API | 300 requests | visitor IP |
| Admin API | 600 requests | visitor IP |
| Whole API | 3000 requests | connecting address (cannot be faked) |
| Failed logins | 5 | visitor IP |
| Failed logins | 30 | connecting address |
| Failed logins | 10 per hour | account email |
| Enquiries | 5 per hour | visitor IP |
| Image uploads | 30 | visitor IP |

Over a limit -> `429` with `{ "error": "..." }`.

## Errors

Invalid input returns 400 with the invalid field(s) listed:

```json
{ "error": "Invalid query parameters", "fields": { "limit": "Too big: expected number to be <=50" } }
```

```json
{ "error": "Invalid car id", "fields": { "id": "Invalid input: expected number, received NaN" } }
```
