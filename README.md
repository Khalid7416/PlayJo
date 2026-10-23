# PlayJo – Sports Facility Directory & Booking Platform (Jordan)

## 1. Folder Structure

```
playjo/
├── index.html                  # Landing page (customer view)  ← delivered
├── otp.js                      # Mock SMS OTP flow              ← delivered
├── app.js                      # Sample data, filters, map      ← delivered
├── schema.sql                  # PostgreSQL schema + seed data  ← delivered
├── README.md
│
├── pages/
│   ├── auth/
│   │   ├── login.html
│   │   ├── register.html
│   │   └── verify-otp.html     # Standalone OTP screen (same logic as modal)
│   ├── customer/
│   │   ├── deals.html
│   │   ├── facility.html       # Facility detail + booking calendar
│   │   ├── booking-checkout.html
│   │   └── dashboard.html      # Points, active discounts, booking history
│   ├── owner/                  # Role: facility_owner
│   │   ├── dashboard.html      # Revenue + booking analytics
│   │   ├── bookings.html       # Upcoming / past bookings
│   │   ├── facility-settings.html  # Details, images, schedule
│   │   └── promotions.html
│   └── admin/                  # Role: super_admin
│       ├── dashboard.html      # Platform analytics
│       ├── users.html
│       └── facilities.html     # Approve / edit / remove
│
├── assets/
│   ├── css/custom.css
│   ├── img/
│   └── js/
│       ├── api.js              # fetch wrapper (JWT in Authorization header)
│       ├── auth-guard.js       # Redirects by role (RBAC on the client)
│       ├── booking.js
│       ├── loyalty.js
│       └── charts.js
│
└── server/                     # Backend (Node/Express suggested)
    ├── src/
    │   ├── routes/             # auth, facilities, bookings, promotions, admin
    │   ├── middleware/         # requireAuth, requireRole('super_admin'), rateLimit
    │   ├── services/           # otp.service (Twilio/Unifonic), loyalty.service
    │   └── db/                 # migrations (schema.sql)
    └── .env                    # DB url, JWT secret, SMS provider keys
```

## 2. Architecture Notes

- **Frontend:** static HTML + Tailwind (CDN for prototyping; use the Tailwind CLI for production) + vanilla JS.
- **Backend (suggested):** Node.js/Express + PostgreSQL, JWT auth. Any stack works since the SQL is standard Postgres.
- **RBAC:** `users.role_id → roles`. Every API route is protected by `requireRole(...)`. Client-side guards are only for UX; the server is the source of truth.
- **OTP:** Server generates a 6-digit code, stores only a **hash** in `otp_verifications`, sends via an SMS gateway (Twilio, Unifonic, or a local Jordanian provider), expires in 5 minutes, max 5 attempts, resend cooldown. On success sets `users.phone_verified = TRUE`. Bookings require `phone_verified = TRUE`.
- **Loyalty:** 10 points per 1 JOD spent. Multiplier based on bookings in the last 30 days: 1–2 → x1.0, 3–4 → x1.25, 5+ → x1.5. 100 points = 1 JOD discount. (See `loyalty_transactions`.)
- **Double-booking prevention:** unique/exclusion constraint on (court_id, time range) in `bookings`.

## 3. Running the Prototype

Open `index.html` in a browser (needs internet for the Tailwind and Leaflet CDNs).
In the OTP demo, the "SMS" code is shown in a toast and printed in the console, since no real SMS is sent.

## 4. Demo Accounts (seed data)

| Role | Name | Email | Phone |
|---|---|---|---|
| Customer | Omar Haddad | omar@example.com | +962791234567 (1,250 pts) |
| Facility Owner | Layla Nasser | owner@trax.example.com | +962781112233 |
| Super Admin | PlayJo Admin | admin@playjo.example.com | +962799000000 |

Password hashes in the seed are placeholders. Replace them with real bcrypt/argon2 hashes.

## 5. Next Steps

1. Build the API (auth → facilities → bookings).
2. Plug in a real SMS provider.
3. Add payments (cash on arrival, CliQ, or card gateway).
4. Add Arabic/RTL support (Tailwind `rtl:` variants) – important for the Jordanian market.
