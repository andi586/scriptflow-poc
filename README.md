This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## ScriptFlow pipeline (prod)

### Database migrations (no manual SQL in Dashboard)

1. Add **`DATABASE_URL`** to `.env.local` — Supabase → **Project Settings → Database → Connection string** (URI; use **Session mode** pooler or direct; password URL-encoded if needed).
2. Run **`npm run db:migrate`**. This applies any **pending** files in `supabase/migrations/` in order, records them in `_scriptflow_migrations`, and runs **`NOTIFY pgrst, 'reload schema'`** when something new was applied (refreshes PostgREST cache).
3. **CI:** On push to `main`, `.github/workflows/supabase-migrations.yml` runs the same command. Add repository secret **`DATABASE_URL`** (same URI) so migrations apply automatically — no copy-paste in SQL Editor.

Single-file apply (advanced): `npm run db:migrate:file -- path/to/file.sql`

4. Copy `.env.example` → `.env.local` and fill keys. For the **New project (demo)** button, set `SCRIPTFLOW_DEMO_USER_ID` to a real `auth.users.id` UUID in that Supabase project.
5. Browse preset character templates at `/character-templates` (API: `GET/POST /api/character-templates`).

**Supabase CLI (optional alternative):** after `supabase link`, `npx supabase db push` pushes the same migration files to the linked project.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
