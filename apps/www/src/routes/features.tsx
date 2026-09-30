import { createFileRoute } from '@tanstack/react-router'
import { FeaturesPage } from '@/pages/features'
import { pageHead } from '@/lib/og'

const TITLE = 'Features — Workspaces, Teams, PBAC, Billing, Audit Logs · Orbit'
const DESCRIPTION =
  'Everything a SaaS needs already wired up: multi-tenant workspaces, nested teams, two-scope PBAC, Stripe / Polar / Dodo billing, audit logs, realtime, email, uploads, and background jobs.'

export const Route = createFileRoute('/features')({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: '/features',
    }),
  component: FeaturesPage,
})
