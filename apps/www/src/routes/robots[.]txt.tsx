import { createFileRoute } from '@tanstack/react-router'
import { WWW_URL } from '@/lib/urls'

const BODY = `User-agent: *
Allow: /
Disallow: /thank-you
Disallow: /connect-github
Disallow: /og

Sitemap: ${WWW_URL}/sitemap.xml

# AI / answer-engine discovery
# https://llmstxt.org
# Markdown index: ${WWW_URL}/llms.txt
# Full content:   ${WWW_URL}/llms-full.txt
`

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(BODY, {
          status: 200,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=3600, s-maxage=86400',
          },
        }),
    },
  },
})
