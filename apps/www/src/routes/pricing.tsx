import { createFileRoute } from '@tanstack/react-router'
import { PricingPage } from '@/pages/pricing'
import { pageHead } from '@/lib/og'

const TITLE = 'Pricing — Orbit | One-time SaaS starter for Next.js & TanStack'
const DESCRIPTION =
  'One-time payment, lifetime updates, unlimited projects. Free open-source starter, or the commercial Builder tier with teams, billing, jobs, uploads, and Resend.'

export const Route = createFileRoute('/pricing')({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: '/pricing',
    }),
  component: PricingPage,
})
