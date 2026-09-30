import { createFileRoute } from '@tanstack/react-router'
import { TechStackPage } from '@/pages/tech-stack'
import { pageHead } from '@/lib/og'

const TITLE =
  'Tech stack — Next.js 16, TanStack Start, Hono, Drizzle, Stripe, better-auth · Orbit'
const DESCRIPTION =
  'The opinionated TypeScript stack behind Orbit: Next.js 16 or TanStack Start, Hono REST API, Drizzle + Postgres, better-auth, Stripe / Polar / Dodo, Tailwind v4, Resend, and graphile-worker.'

export const Route = createFileRoute('/tech-stack')({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: '/tech-stack',
    }),
  component: TechStackPage,
})
