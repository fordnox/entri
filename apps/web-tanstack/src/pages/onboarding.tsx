import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@orbit/ui/button";
import { Input } from "@orbit/ui/input";
import { Label } from "@orbit/ui/label";
import { ApiError, api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/**
 * First-run screen for a signed-in user with no workspace. A workspace
 * is the tenant that owns Connect applications and their domains.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.workspaces.create({ name: name.trim(), slug: effectiveSlug });
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      await navigate({
        to: "/d/$workspaceSlug/connect/applications",
        params: { workspaceSlug: res.workspace.slug },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-lg">
      <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.3em]">
        Getting started
      </div>
      <h1 className="mt-2 font-heading text-3xl leading-tight">Create your workspace</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Your workspace holds your Connect applications and every domain your users connect.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="ws-name">Workspace name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Hosting"
            maxLength={64}
            autoFocus
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ws-slug">URL</Label>
          <Input
            id="ws-slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="acme-hosting"
            minLength={3}
            maxLength={32}
            required
          />
          <p className="text-muted-foreground text-xs">/d/{effectiveSlug || "your-workspace"}</p>
        </div>
        {error ? <p className="text-destructive-foreground text-sm">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy || !name.trim() || effectiveSlug.length < 3}>
          {busy ? "Creating…" : "Create workspace"}
        </Button>
      </form>
    </div>
  );
}
