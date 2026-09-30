import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ConnectGithubPage } from '@/pages/connect-github'
import { pageHead } from '@/lib/og'

const searchSchema = z.object({
  checkout_id: z.string().optional(),
  customer_session_token: z.string().optional(),
})

export const Route = createFileRoute('/connect-github')({
  validateSearch: searchSchema,
  head: () =>
    pageHead({
      title: 'Connect GitHub · Orbit',
      description: 'Connect your GitHub account to get access to the Orbit private template repository.',
      noindex: true,
    }),
  component: RouteComponent,
})

function RouteComponent() {
  const { checkout_id } = Route.useSearch()
  return <ConnectGithubPage initialCheckoutId={checkout_id ?? ''} />
}
