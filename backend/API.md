# SafarGo API

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
  "currency": "PKR",
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
      "currency": "PKR",
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
  "currency": "PKR",
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
  "phone": "+92 300 1234567",
  "email": "ali@example.com",
  "carId": 1,
  "pickupLocation": "Lahore",
  "dropoffLocation": "Islamabad",
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

## Errors

Invalid input returns 400 with the invalid field(s) listed:

```json
{ "error": "Invalid query parameters", "fields": { "limit": "Too big: expected number to be <=50" } }
```

```json
{ "error": "Invalid car id", "fields": { "id": "Invalid input: expected number, received NaN" } }
```
