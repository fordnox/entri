/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import appCss from '@orbit/ui/styles.css?url'
import {
  ORBIT_THEME_STORAGE_KEY,
  ThemeProvider,
} from '@orbit/ui/theme-provider'
import { JsonLd } from '@/components/json-ld'
import { organizationJsonLd, socialMeta, websiteJsonLd } from '@/lib/og'

const ORBIT_THEME_HEAD_SCRIPT = `!function(){try{var k=${JSON.stringify(ORBIT_THEME_STORAGE_KEY)};var p=localStorage.getItem(k);if(p!=="light"&&p!=="dark"&&p!=="system")p="system";var dark=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);}catch(e){}}();`

const DEFAULT_TITLE = 'Orbit — opinionated SaaS starter kit for Next.js & TanStack Start'
const DEFAULT_DESCRIPTION =
  'Scaffold a production-ready SaaS in minutes. Multi-tenant workspaces, teams, PBAC, billing (Stripe/Polar/Dodo), audit logs, realtime, and email — all wired up and typed end-to-end.'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { name: 'color-scheme', content: 'light dark' },
      { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#ffffff' },
      { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#0a0a0a' },
      { name: 'application-name', content: 'Orbit' },
      { name: 'apple-mobile-web-app-title', content: 'Orbit' },
      { name: 'format-detection', content: 'telephone=no' },
      { title: DEFAULT_TITLE },
      ...socialMeta({
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'mask-icon', href: '/favicon.svg', color: '#0a0a0a' },
      { rel: 'apple-touch-icon', href: '/favicon.svg' },
    ],
    scripts: [
      {
        src: 'https://analytics.ahrefs.com/analytics.js',
        'data-key': 'c8x6LreZqkjh/dhMljODFA',
        async: true,
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: ORBIT_THEME_HEAD_SCRIPT }}
        />
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <ThemeProvider>{children}</ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
