import { createFileRoute } from '@tanstack/react-router'
import { ConfigurePage } from '@/pages/configure'
import { pageHead } from '@/lib/og'

const TITLE = 'Configure — Pick your stack · Orbit'
const DESCRIPTION =
  'Pick your framework, ORM, billing provider, and feature set. Generate the exact npx create-orb command for your SaaS.'

export const Route = createFileRoute('/configure')({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: '/configure',
    }),
  component: ConfigurePage,
})
