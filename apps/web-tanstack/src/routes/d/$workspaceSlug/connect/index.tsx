import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/d/$workspaceSlug/connect/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/d/$workspaceSlug/connect/applications",
      params: { workspaceSlug: params.workspaceSlug },
    });
  },
});
