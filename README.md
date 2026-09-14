# Attar World Sonar Bangla — Admin panel

Staff panel for orders, inventory, products, coupons and couriers. Next.js
(App Router), React 19 and Tailwind CSS 4.

- API: https://github.com/Souvik-Ghosh-js/AWSB
- Storefront: https://github.com/Souvik-Ghosh-js/AWSB-FE

## Why this is a separate app

The panel is deployed on its own subdomain, apart from the storefront, on
purpose: an XSS bug in the shop cannot reach an admin token held on a
different origin, and customers never download the admin bundle.

## Getting started

```bash
npm ci
cp .env.example .env.local   # then fill in the blanks
npm run dev
```

Runs on http://localhost:3001 and expects the API at http://localhost:4000/api/v1.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on port 3001 |
| `npm run build` | Production build |
| `npm start` | Serve the production build on port 3001 |
| `npm run lint` | Lint |
| `npm run typecheck` | `tsc --noEmit` |

## Configuration

Copy `.env.example` to `.env.local`. It must point at the same API the
storefront uses. Everything here is `NEXT_PUBLIC_` and reaches the browser,
so no secret belongs in this file.

`NEXT_PUBLIC_USE_MOCKS=true` renders the panel against fixture data when the
API is not running. Never set it to true in production.
