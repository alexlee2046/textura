# Textura

Open material platform. Next.js 16 + TypeScript + Tailwind v4 + Shadcn UI + next-intl + Supabase Auth + Prisma.

## Commands

```bash
npm run dev          # Dev server (Turbopack) at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npx prisma migrate dev   # Run DB migrations
npx prisma generate      # Regenerate Prisma client
```

## Conventions

- Path alias: `@/*` -> `./src/*`
- i18n: `next-intl`, locales zh (default) + en, messages in `src/messages/`
- UI: Shadcn components in `src/components/ui/`
- Styling: Tailwind CSS v4, Shadcn theme (Zinc base)
- Toast: Use `sonner` (not deprecated toast)
