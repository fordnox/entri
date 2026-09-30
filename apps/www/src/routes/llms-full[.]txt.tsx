import { createFileRoute } from "@tanstack/react-router";
import { llmsFullText } from "@/lib/docs-md";

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: () => {
        const body = llmsFullText();
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
