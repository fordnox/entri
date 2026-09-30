import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orbit/ui/table";
import { API_URL } from "@/lib/urls";
import { useWorkspaceSlug } from "@/lib/use-workspace-slug";
import { clientSnippet, scriptTagSnippet, serverSnippet } from "./application-detail-page";
import { CodeBlock, PANEL, PageHeader } from "./shared";

const WEBHOOK_VERIFY_SNIPPET = `import crypto from "node:crypto";
import express from "express";

const app = express();
const SIGNING_SECRET = process.env.CONNECT_WEBHOOK_SECRET;
const TOLERANCE_SECONDS = 5 * 60;

// Use the RAW body — re-serialized JSON will not match the signature.
app.post("/webhooks/connect", express.raw({ type: "application/json" }), (req, res) => {
  const header = req.get("Connect-Signature") ?? "";
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=", 2)),
  );
  const t = Number(parts.t);
  const v1 = parts.v1 ?? "";

  if (!t || Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) {
    return res.status(400).send("stale or missing timestamp");
  }

  const expected = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(\`\${t}.\${req.body.toString("utf8")}\`)
    .digest("hex");

  const ok =
    expected.length === v1.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  if (!ok) return res.status(400).send("bad signature");

  const event = JSON.parse(req.body.toString("utf8"));
  switch (event.type) {
    case "domain.connected":
      // event.data.connection.domain is live — provision TLS, flip routing…
      break;
    case "domain.disconnected":
    case "domain.setup_failed":
      break;
  }
  res.sendStatus(200);
});`;

const RECORD_TYPES: { type: string; host: string; value: string; notes: string }[] = [
  { type: "A", host: "@", value: "76.76.21.21", notes: "IPv4 address. Typical for apex domains." },
  { type: "AAAA", host: "@", value: "2606:4700::1111", notes: "IPv6 address." },
  { type: "CNAME", host: "www", value: "cname.yourapp.com", notes: "Alias. Not allowed on the apex by most providers." },
  { type: "TXT", host: "_verify", value: "yourapp-verification={DOMAIN}", notes: "Ownership proofs, SPF, etc." },
  { type: "MX", host: "@", value: "mx.yourapp.com", notes: "Mail. Requires `priority`." },
  { type: "CAA", host: "@", value: '0 issue "letsencrypt.org"', notes: "Restricts which CAs may issue certificates." },
];

export function ConnectGuidePage() {
  const slug = useWorkspaceSlug() ?? "";
  const appId = "app_…";

  return (
    <div>
      <PageHeader
        title="Integration guide"
        description="Let your users connect their own domain to your product in five steps. Connect sets DNS automatically through the provider's API when it can, and falls back to copy-paste instructions with live verification when it can't."
      />

      <ol className="space-y-12">
        <Step n={1} title="Create an application">
          <p>
            In{" "}
            <Link
              to="/d/$workspaceSlug/connect/applications"
              params={{ workspaceSlug: slug }}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Connect → Applications
            </Link>
            , create an application. You get an <Code>applicationId</Code> (
            <Code>app_…</Code>) and a <Code>secret</Code> (<Code>sk_…</Code>).
            The secret is shown once — store it with your server's other
            credentials.
          </p>
        </Step>

        <Step n={2} title="Load the SDK">
          <p>Either install the package, or drop in the script tag which defines <Code>window.Connect</Code>.</p>
          <CodeBlock label="bash" code={`npm install @orbit/connect-js`} />
          <CodeBlock label="html" code={`<script src="${API_URL}/sdk/connect.js"></script>`} />
        </Step>

        <Step n={3} title="Mint a token on your server">
          <p>
            Never ship the secret to a browser. Exchange it server-side for an{" "}
            <Code>auth_token</Code> that is valid for one hour, and hand only the
            token to your frontend.
          </p>
          <CodeBlock label="bash" code={serverSnippet(appId)} />
        </Step>

        <Step n={4} title="Open the modal">
          <p>
            Pass the records your platform needs. The modal detects the user's DNS
            provider, then sets them automatically or walks the user through adding
            them by hand.
          </p>
          <CodeBlock label="js" code={clientSnippet(appId)} />
          <p>Or, with the script tag:</p>
          <CodeBlock label="html" code={scriptTagSnippet(appId)} />
          <p>
            Every callback is also dispatched on <Code>window</Code> as a{" "}
            <Code>CustomEvent</Code>: <Code>onConnectSuccess</Code>,{" "}
            <Code>onConnectClose</Code>, <Code>onConnectStepChange</Code> (payload
            in <Code>event.detail</Code>).
          </p>
        </Step>

        <Step n={5} title="Handle webhooks">
          <p>
            Connect POSTs <Code>domain.connected</Code>, <Code>domain.disconnected</Code>{" "}
            and <Code>domain.setup_failed</Code> to the application's webhook URL.
            Verify the <Code>Connect-Signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</Code>{" "}
            header, where <Code>hex</Code> is{" "}
            <Code>HMAC-SHA256(webhookSigningSecret, "&lt;t&gt;.&lt;raw body&gt;")</Code>.
            The signing secret is on each application's page.
          </p>
          <CodeBlock label="node" code={WEBHOOK_VERIFY_SNIPPET} />
        </Step>
      </ol>

      <section className="mt-14">
        <h2 className="text-[15px] font-semibold">DNS record reference</h2>
        <div className="mt-2 space-y-2 text-[13px] text-muted-foreground leading-relaxed [text-wrap:pretty]">
          <p>
            <Code>host</Code> is relative to what the user types: <Code>@</Code> is the
            domain itself, <Code>www</Code> is <Code>www.&lt;domain&gt;</Code>. TTL
            defaults to 300 seconds.
          </p>
          <p>
            <Code>host</Code> and <Code>value</Code> accept placeholders:{" "}
            <Code>{"{DOMAIN}"}</Code> (what the user entered, e.g.{" "}
            <Code>shop.acme.com</Code>), <Code>{"{ROOT_DOMAIN}"}</Code> (
            <Code>acme.com</Code>) and <Code>{"{SUBDOMAIN}"}</Code> (<Code>shop</Code>,
            or empty).
          </p>
          <p>
            A flat array applies to every domain. The{" "}
            <Code>{"{ domain, subDomain }"}</Code> form picks by whether the user
            entered a registrable domain or a subdomain — handy when apexes need an
            A record but subdomains need a CNAME.
          </p>
        </div>
        <div className={`${PANEL} mt-4 overflow-hidden`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Example host</TableHead>
                <TableHead>Example value</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RECORD_TYPES.map((r) => (
                <TableRow key={r.type}>
                  <TableCell className="font-mono text-[12px] font-medium">{r.type}</TableCell>
                  <TableCell className="font-mono text-[12px]">{r.host}</TableCell>
                  <TableCell className="font-mono text-[12px]">{r.value}</TableCell>
                  <TableCell className="whitespace-normal text-[12px] text-muted-foreground">{r.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-[15px] font-semibold">Errors</h2>
        <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
          Errors use the shape <Code>{'{ "error": { "code", "message" } }'}</Code>. Notable
          codes:
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            "token.invalid",
            "token.expired",
            "origin_not_allowed",
            "domain.invalid",
            "dns_records.invalid",
            "provider.not_automated",
            "provider.invalid_credentials",
            "provider.zone_not_found",
            "provider.permission_denied",
            "provider.rate_limited",
            "provider.error",
          ].map((c) => (
            <code key={c} className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[11px]">
              {c}
            </code>
          ))}
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
      <div className="flex size-7 items-center justify-center rounded-full border border-border/60 bg-muted/40 font-mono text-[12px] font-semibold">
        {n}
      </div>
      <div className="min-w-0 space-y-3">
        <h2 className="pt-0.5 text-[15px] font-semibold">{title}</h2>
        <div className="space-y-3 text-[13px] text-muted-foreground leading-relaxed [text-wrap:pretty]">
          {children}
        </div>
      </div>
    </li>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted/60 px-1 py-px font-mono text-[12px] text-foreground">{children}</code>;
}
