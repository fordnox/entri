import { createFileRoute } from '@tanstack/react-router'
import { DOCS_NAV } from '@/components/docs-layout'
import { WWW_URL } from '@/lib/urls'

type SitemapEntry = {
  loc: string
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  priority: string
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/pricing', changefreq: 'weekly', priority: '0.9' },
  { loc: '/features', changefreq: 'weekly', priority: '0.8' },
  { loc: '/tech-stack', changefreq: 'monthly', priority: '0.7' },
  { loc: '/changelog', changefreq: 'weekly', priority: '0.7' },
  { loc: '/configure', changefreq: 'monthly', priority: '0.6' },
  { loc: '/docs', changefreq: 'weekly', priority: '0.8' },
  { loc: '/tanstack-start-saas-boilerplate', changefreq: 'monthly', priority: '0.8' },
  { loc: '/better-auth-boilerplate', changefreq: 'monthly', priority: '0.8' },
  { loc: '/multi-tenant-saas-boilerplate', changefreq: 'monthly', priority: '0.8' },
  { loc: '/nextjs-stripe-boilerplate', changefreq: 'monthly', priority: '0.8' },
  { loc: '/compare/orbit-vs-shipfast', changefreq: 'monthly', priority: '0.7' },
  { loc: '/compare/orbit-vs-makerkit', changefreq: 'monthly', priority: '0.7' },
  { loc: '/blog/best-nextjs-saas-boilerplates-2026', changefreq: 'monthly', priority: '0.7' },
]

function buildEntries(): SitemapEntry[] {
  const docs = DOCS_NAV.flatMap((group) =>
    group.entries
      .filter((e): e is { label: string; to: string } => typeof e.to === 'string')
      .map<SitemapEntry>((e) => ({
        loc: e.to,
        changefreq: 'monthly',
        priority: '0.6',
      })),
  )
  return [...STATIC_ENTRIES, ...docs]
}

function renderSitemap(entries: SitemapEntry[], lastmod: string): string {
  const urls = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${WWW_URL}${e.loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => {
        const lastmod = new Date().toISOString().slice(0, 10)
        const xml = renderSitemap(buildEntries(), lastmod)
        return new Response(xml, {
          status: 200,
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=3600, s-maxage=86400',
          },
        })
      },
    },
  },
})
