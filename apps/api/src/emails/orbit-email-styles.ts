/** Shared layout tokens for Orbit transactional emails. */
export const orbitEmailStyles = {
  page: {
    backgroundColor: "#f4f4f5",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  } as const,
  container: {
    margin: "0 auto",
    padding: "24px 16px 48px",
    maxWidth: "560px",
  } as const,
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "32px 28px",
    border: "1px solid #e4e4e7",
  } as const,
  eyebrow: {
    color: "#71717a",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    margin: "0 0 16px",
  },
  heading: {
    color: "#18181b",
    fontSize: "22px",
    fontWeight: 600,
    lineHeight: "1.3",
    margin: "0 0 16px",
  },
  text: {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 12px",
  },
  muted: {
    color: "#71717a",
    fontSize: "13px",
    lineHeight: "1.5",
    margin: "0 0 20px",
  },
  button: {
    backgroundColor: "#18181b",
    borderRadius: "6px",
    color: "#fafafa",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center" as const,
    display: "block",
    padding: "12px 20px",
  },
  footer: {
    color: "#a1a1aa",
    fontSize: "12px",
    lineHeight: "1.5",
    margin: "24px 0 0",
  },
};
