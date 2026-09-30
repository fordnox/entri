import { createFileRoute } from "@tanstack/react-router";
import { lookupDocBySlug, mdxToMarkdown } from "@/lib/docs-md";

export const Route = createFileRoute("/docs/$")({
  server: {
    handlers: {
      GET: ({ params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        if (!splat.endsWith(".md")) {
          return new Response("Not found", { status: 404 });
        }
        const slug = splat.replace(/\.md$/, "");
        const doc = lookupDocBySlug(slug);
        if (!doc) {
          return new Response("Not found", { status: 404 });
        }
        const md = mdxToMarkdown(doc.raw);
        return new Response(md, {
          status: 200,
          headers: {
            "content-type": "text/markdown; charset=utf-8",
            "cache-control": "public, max-age=3600, s-maxage=86400",
          },
        });
      },
    },
  },
});
