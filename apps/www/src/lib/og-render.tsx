import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "@vercel/og";

let cachedFonts: { regular: Buffer; semibold: Buffer } | null = null;
let fontPromise: Promise<{
  regular: Buffer;
  semibold: Buffer;
}> | null = null;

// Resolves to apps/www/public/fonts in dev (cwd = apps/www) and to
// /app/public/fonts in the production Docker image (cwd = /app, with the
// Nitro .output contents copied to /app). Self-fetching the assets back
// through the public origin goes via the edge proxy and 502s under load.
function fontPath(name: string) {
  return path.join(process.cwd(), "public", "fonts", name);
}

async function loadFonts() {
  if (cachedFonts) return cachedFonts;
  if (!fontPromise) {
    fontPromise = (async () => {
      const [regular, semibold] = await Promise.all([
        readFile(fontPath("Geist-Regular.ttf")),
        readFile(fontPath("Geist-SemiBold.ttf")),
      ]);
      cachedFonts = { regular, semibold };
      return cachedFonts;
    })();
  }
  return fontPromise;
}

export type OgParams = {
  title: string;
  kicker?: string;
  description?: string;
  variant?: "marketing" | "docs";
};

export async function renderOg(params: OgParams): Promise<Response> {
  const { regular, semibold } = await loadFonts();
  const { title, kicker, description, variant = "marketing" } = params;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 20% 0%, #1a1a2e 0%, #0a0a0a 50%)",
          color: "#fafafa",
          fontFamily: "Geist",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "22px",
            color: "#a1a1aa",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "9999px",
              backgroundColor: "#fafafa",
            }}
          />
          {kicker ?? (variant === "docs" ? "Orbit Docs" : "Orbit")}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            marginTop: "auto",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              fontSize: title.length > 40 ? "60px" : "72px",
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: "1000px",
            }}
          >
            {title}
          </div>
          {description ? (
            <div
              style={{
                fontSize: "26px",
                color: "#a1a1aa",
                lineHeight: 1.4,
                maxWidth: "950px",
              }}
            >
              {description.length > 140
                ? `${description.slice(0, 137)}…`
                : description}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "24px",
            color: "#71717a",
            borderTop: "1px solid #27272a",
            paddingTop: "24px",
          }}
        >
          <div>wereorbit.com</div>
          <div>move together</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
      ],
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
