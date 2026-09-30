import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VIRTUAL_ID = 'virtual:docs-md-manifest'
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`

/**
 * Bundles the raw `.mdx` source for every docs page into a virtual module:
 *   import manifest from 'virtual:docs-md-manifest'
 * Used by the `.md` server route to serve docs as plain markdown for AI
 * agents — bypasses MDX compilation by reading the file directly at build
 * time.
 */
const docsMdManifestPlugin: Plugin = {
  name: 'docs-md-manifest',
  enforce: 'pre',
  resolveId(id) {
    if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID
    return null
  },
  async load(id) {
    if (id !== RESOLVED_VIRTUAL_ID) return null
    const root = path.join(__dirname, 'src/pages/docs')
    const files = await walkMdx(root)
    const entries: Record<string, string> = {}
    for (const abs of files) {
      const rel = path.relative(root, abs).replace(/\\/g, '/')
      const slug = rel.replace(/\.mdx$/, '')
      entries[slug] = await readFile(abs, 'utf8')
    }
    return `export default ${JSON.stringify(entries)};`
  },
}

async function walkMdx(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walkMdx(full)))
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      out.push(full)
    }
  }
  return out
}

export default defineConfig({
  server: { port: 4000 },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  plugins: [
    docsMdManifestPlugin,
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: 'frontmatter' }],
        ],
        providerImportSource: '@mdx-js/react',
      }),
    },
    tailwindcss(),
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
})
