/**
 * Loads raw `.mdx` files at build time and converts them to plain markdown
 * suitable for AI agents. Strips MDX-only constructs (`import` lines, the
 * frontmatter block, custom JSX components) so the output is portable
 * markdown.
 */

// @ts-expect-error — virtual module supplied by docsMdManifestPlugin in vite.config.ts
import manifest from "virtual:docs-md-manifest";

type DocsMdEntry = {
  /** URL path of the docs page, e.g. "/docs/getting-started/quickstart" */
  path: string;
  /** Slug used in the .md URL — same shape as `path` minus the leading "/docs/" */
  slug: string;
  /** Raw .mdx file contents */
  raw: string;
};

const entries: DocsMdEntry[] = [];
const bySlug = new Map<string, DocsMdEntry>();

for (const [slug, raw] of Object.entries(manifest as Record<string, string>)) {
  const path = `/docs/${slug}`;
  const entry = { path, slug, raw };
  entries.push(entry);
  bySlug.set(slug, entry);
}

entries.sort((a, b) => a.path.localeCompare(b.path));

export function allDocs(): DocsMdEntry[] {
  return entries;
}

export function lookupDocBySlug(slug: string): DocsMdEntry | undefined {
  return bySlug.get(slug);
}

/**
 * Converts an .mdx file body to plain markdown:
 *   1. Strips the YAML frontmatter
 *   2. Strips top-level `import` statements
 *   3. Replaces a small set of known custom JSX components with markdown
 *      equivalents (DocsCallout, DocsTable). Unknown JSX is
 *      passed through verbatim so agents can still parse it.
 */
export function mdxToMarkdown(raw: string): string {
  let body = raw;

  // 1. Strip frontmatter (--- ... ---) at the top of the file
  body = body.replace(/^---\n[\s\S]*?\n---\n+/, "");

  // 2. Strip top-level `import` lines
  body = body
    .split("\n")
    .filter((line) => !/^import\s+.*\sfrom\s+['"][^'"]+['"];?\s*$/.test(line))
    .join("\n");

  // 3. Replace common custom components with markdown-friendly equivalents
  body = simplifyDocsCallout(body);

  // 4. Collapse triple+ blank lines
  body = body.replace(/\n{3,}/g, "\n\n").trimStart();

  return body;
}

/** <DocsCallout kind="warn">body</DocsCallout> → > **Heads up**\n> body */
function simplifyDocsCallout(body: string): string {
  return body.replace(
    /<DocsCallout(?:\s+kind="(warn|note)")?\s*>([\s\S]*?)<\/DocsCallout>/g,
    (_match, kind, inner: string) => {
      const label = kind === "warn" ? "**Heads up**" : "**Note**";
      const lines = inner.trim().split("\n").map((l) => `> ${l}`).join("\n");
      return `> ${label}\n${lines}`;
    },
  );
}

/**
 * Builds a llms.txt index — Markdown listing of all docs pages with their
 * descriptions, formatted per https://llmstxt.org.
 */
export function llmsTxtIndex(opts: { siteUrl: string }): string {
  const out: string[] = [];
  out.push("# Orbit");
  out.push("");
  out.push(
    "> An opinionated SaaS starter kit. Multi-tenant workspaces, teams, PBAC, billing (Stripe / Polar / Dodo), audit logs, realtime, email, and uploads — wired up and typed end-to-end. Scaffolded by `npx create-orb`.",
  );
  out.push("");
  out.push("## Pages");
  out.push("");
  out.push(`- [Home](${opts.siteUrl}/): landing page`);
  out.push(`- [Pricing](${opts.siteUrl}/pricing): one-time payment tiers`);
  out.push(`- [Features](${opts.siteUrl}/features): feature inventory`);
  out.push(`- [Tech stack](${opts.siteUrl}/tech-stack): the libraries Orbit is built on`);
  out.push(`- [Changelog](${opts.siteUrl}/changelog): release history`);
  out.push("");
  out.push("## Docs");
  out.push("");

  // Group docs by top-level section
  const groups = new Map<string, DocsMdEntry[]>();
  for (const entry of entries) {
    const section = entry.slug.split("/")[0] ?? "other";
    const list = groups.get(section) ?? [];
    list.push(entry);
    groups.set(section, list);
  }

  const sectionOrder = [
    "getting-started",
    "concepts",
    "guides",
    "integrations",
    "deploy",
  ];
  const sortedSections = [...groups.keys()].sort((a, b) => {
    const ia = sectionOrder.indexOf(a);
    const ib = sectionOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  for (const section of sortedSections) {
    const items = groups.get(section);
    if (!items) continue;
    out.push(`### ${section.replace(/-/g, " ")}`);
    out.push("");
    for (const item of items) {
      const fm = parseFrontmatter(item.raw);
      const title = fm.title ?? item.slug;
      const desc = fm.description ?? "";
      out.push(
        `- [${title}](${opts.siteUrl}${item.path}.md): ${desc}`,
      );
    }
    out.push("");
  }

  return out.join("\n");
}

export function llmsFullText(): string {
  const out: string[] = [];
  out.push("# Orbit — full documentation");
  out.push("");
  for (const entry of entries) {
    const fm = parseFrontmatter(entry.raw);
    out.push(`# ${fm.title ?? entry.slug}`);
    if (fm.description) {
      out.push("");
      out.push(`> ${fm.description}`);
    }
    out.push("");
    out.push(mdxToMarkdown(entry.raw));
    out.push("");
    out.push("---");
    out.push("");
  }
  return out.join("\n");
}

function parseFrontmatter(raw: string): { title?: string; description?: string; kicker?: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const body = match[1];
  const out: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (m) {
      const [, key, value] = m;
      out[key] = value.replace(/^['"]|['"]$/g, "").trim();
    }
  }
  return out;
}
