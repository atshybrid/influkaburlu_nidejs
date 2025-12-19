This is the Kaburlu PR Dashboard (Next.js).

## Getting Started

### Prerequisites

- Backend running (default: `http://localhost:4000`)
- A PR user account + JWT login access

### Configure

- Copy `.env.local.example` to `.env.local` and set `API_BASE_URL` if your backend isn't on `http://localhost:4000`.

Install and run the development server:

```bash
cd apps/pr-dashboard
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open `http://localhost:3000` and login with your PR credentials.

### Backend APIs used

- `POST /api/auth/login`
- `GET /api/pr/brands`
- `GET /api/pr/brands/:brandUlid/ads`
- `GET /api/pr/commissions`

This app proxies `/api/*` through Next.js to the backend using rewrites (avoids CORS issues in local dev).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
