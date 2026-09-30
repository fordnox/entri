import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from '@/pages/landing'
import { pageHead } from '@/lib/og'

const TITLE =
  'Multi-Tenant SaaS Boilerplate — TanStack Start (free) + Next.js (paid) | Orbit'
const DESCRIPTION =
  'A production-ready multi-tenant SaaS boilerplate scaffolded by one CLI. Free starter: TanStack Start + Hono + Postgres + better-auth + workspaces + PBAC. Paid tier: Next.js 16, teams, Stripe / Polar / Dodo billing, audit logs, jobs, email, and uploads.'

export const Route = createFileRoute('/')({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: '/',
    }),
  component: LandingPage,
})
