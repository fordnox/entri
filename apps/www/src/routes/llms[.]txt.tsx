import { createFileRoute } from "@tanstack/react-router";
import { llmsTxtIndex } from "@/lib/docs-md";
import { WWW_URL } from "@/lib/urls";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () => {
        const body = llmsTxtIndex({ siteUrl: WWW_URL });
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600, s-maxage=86400",
          },
        });
      },
    },
  },
});
