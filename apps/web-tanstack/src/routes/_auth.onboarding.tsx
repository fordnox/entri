import { createFileRoute, isRedirect, redirect } from '@tanstack/react-router'
import { ApiError } from '@/lib/api/client'
import { meQueryOptions } from '@/lib/queries/session'
import { OnboardingPage } from '@/pages/onboarding'

export const Route = createFileRoute('/_auth/onboarding')({
  beforeLoad: async ({ context }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions)
      if (me.workspaces.length > 0) throw redirect({ to: '/' })
    } catch (err) {
      if (isRedirect(err)) throw err
      if (err instanceof ApiError && err.status === 401) throw redirect({ to: '/login' })
      throw err
    }
  },
  component: OnboardingPage,
})
