import { createFileRoute } from '@tanstack/react-router'
import { ChangelogPage } from '@/pages/changelog'
import { pageHead } from '@/lib/og'

const TITLE = 'Changelog — Orbit SaaS starter releases'
const DESCRIPTION =
  'Every release that moves the Orbit CLI forward. New adapters, frameworks, bounded contexts, and product primitives — pinned to the version your scaffold was generated from.'

export const Route = createFileRoute('/changelog')({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: '/changelog',
    }),
  component: ChangelogPage,
})
