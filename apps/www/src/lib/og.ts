import { WWW_URL } from "./urls";

export const SITE_NAME = "Orbit";
export const SITE_TAGLINE = "An opinionated SaaS starter kit";
export const TWITTER_SITE = "@wereorbit";

export type OgMetaInput = {
  title: string;
  description?: string;
  kicker?: string;
  variant?: "marketing" | "docs";
  /** Path on www, used for og:url and canonical. Leading slash. */
  path?: string;
};

export type PageHeadInput = OgMetaInput & {
  description: string;
  /** Skip canonical + add robots noindex,nofollow. Use for transactional pages. */
  noindex?: boolean;
};

/** Absolute URL to the dynamic OG image renderer. */
export function ogImageUrl(input: OgMetaInput): string {
  const params = new URLSearchParams();
  params.set("title", input.title);
  if (input.kicker) params.set("kicker", input.kicker);
  if (input.description) params.set("description", input.description);
  if (input.variant) params.set("variant", input.variant);
  return `${WWW_URL}/og?${params.toString()}`;
}

function absoluteUrl(path?: string) {
  return path ? `${WWW_URL}${path}` : WWW_URL;
}

/**
 * Returns a complete <head> descriptor (meta + links) for a route.
 * Pair with TanStack Start's `head()`:
 *
 *   head: () => pageHead({ title: '...', description: '...', path: '/foo' })
 *
 * Note: JSON-LD is rendered separately via the <JsonLd> component because
 * TanStack Start's head().scripts isn't emitted into SSR HTML.
 */
export function pageHead(input: PageHeadInput) {
  const image = ogImageUrl(input);
  const url = absoluteUrl(input.path);

  const meta: Array<Record<string, string>> = [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: input.title },
    { property: "og:url", content: url },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "en_US" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: TWITTER_SITE },
    { name: "twitter:creator", content: TWITTER_SITE },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: input.title },
  ];

  if (input.noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  const links: Array<Record<string, string>> = [];
  if (!input.noindex && input.path !== undefined) {
    links.push({ rel: "canonical", href: url });
  }

  return { meta, links };
}

/**
 * Convenience wrapper for docs routes — suffixes "· Orbit docs" on titles
 * and tags the OG image as the docs variant. BreadcrumbList + TechArticle
 * JSON-LD is added by `<DocsLayout>` itself.
 */
export function docsRouteHead(input: {
  title: string;
  description: string;
  path?: string;
}) {
  return pageHead({
    title: `${input.title} · Orbit docs`,
    description: input.description,
    variant: "docs",
    path: input.path,
  });
}

/**
 * Legacy meta-only helper. Kept for the root route which composes its own
 * head shape. Prefer `pageHead()` for per-route heads.
 */
export function socialMeta(input: OgMetaInput) {
  const image = ogImageUrl(input);
  const url = absoluteUrl(input.path);
  return [
    { name: "description", content: input.description ?? "" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description ?? "" },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: input.title },
    { property: "og:url", content: url },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "en_US" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: TWITTER_SITE },
    { name: "twitter:creator", content: TWITTER_SITE },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description ?? "" },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: input.title },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// JSON-LD builders
// ────────────────────────────────────────────────────────────────────────────

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: WWW_URL,
    logo: `${WWW_URL}/favicon.svg`,
    sameAs: ["https://github.com/were-orbit"],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: WWW_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${WWW_URL}/docs?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function softwareApplicationJsonLd(input: {
  description: string;
  price?: string;
  priceCurrency?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Windows, Linux",
    description: input.description,
    url: WWW_URL,
    ...(input.price && {
      offers: {
        "@type": "Offer",
        price: input.price,
        priceCurrency: input.priceCurrency ?? "USD",
        url: `${WWW_URL}/pricing`,
      },
    }),
  };
}

export function productJsonLd(input: {
  name: string;
  description: string;
  price: string;
  priceCurrency?: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      price: input.price,
      priceCurrency: input.priceCurrency ?? "USD",
      url: input.url,
      availability: "https://schema.org/InStock",
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${WWW_URL}${item.path}`,
    })),
  };
}

export function faqJsonLd(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function techArticleJsonLd(input: {
  title: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: input.title,
    description: input.description,
    url: `${WWW_URL}${input.path}`,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${WWW_URL}/favicon.svg` },
    },
  };
}
