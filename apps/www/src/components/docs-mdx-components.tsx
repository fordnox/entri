import { Link } from "@tanstack/react-router";
import type { Language } from "prism-react-renderer";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import {
  DocsCode,
  DocsCodeBlock,
  DocsH2,
  DocsH3,
  DocsList,
  DocsP,
} from "@/components/docs-layout";

type AnyProps = Record<string, unknown>;

function isElement(node: unknown): node is ReactElement<AnyProps> {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in (node as object) &&
    "props" in (node as object)
  );
}

function flatten(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  if (isElement(node)) return flatten((node.props as AnyProps).children as ReactNode);
  return "";
}

export const docsMdxComponents = {
  h1: () => null,
  h2: (props: ComponentProps<"h2">) => <DocsH2>{props.children}</DocsH2>,
  h3: (props: ComponentProps<"h3">) => <DocsH3>{props.children}</DocsH3>,
  p: (props: ComponentProps<"p">) => <DocsP>{props.children}</DocsP>,
  ul: (props: ComponentProps<"ul">) => <DocsList>{props.children}</DocsList>,
  ol: (props: ComponentProps<"ol">) => <DocsList ordered>{props.children}</DocsList>,
  code: (props: ComponentProps<"code">) => {
    // Inline `code` only — fenced ``` blocks render as <pre><code>... and are caught by pre override
    if (typeof props.children === "string" && !props.className) {
      return <DocsCode>{props.children}</DocsCode>;
    }
    return <code className={props.className}>{props.children}</code>;
  },
  pre: (props: ComponentProps<"pre">) => {
    const child = props.children as ReactNode;
    if (isElement(child)) {
      const childProps = child.props as AnyProps & {
        className?: string;
        children?: ReactNode;
      };
      const className = childProps.className ?? "";
      const match = className.match(/language-([\w-]+)/);
      const lang = (match?.[1] ?? "text") as Language;
      const code = flatten(childProps.children);
      return <DocsCodeBlock lang={lang}>{code}</DocsCodeBlock>;
    }
    return <pre>{props.children}</pre>;
  },
  a: (props: ComponentProps<"a">) => {
    const href = props.href ?? "";
    if (href.startsWith("/")) {
      return (
        <Link
          to={href}
          className="text-foreground underline underline-offset-2 transition-colors hover:text-foreground/80"
        >
          {props.children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
        className="text-foreground underline underline-offset-2 transition-colors hover:text-foreground/80"
      >
        {props.children}
      </a>
    );
  },
  hr: () => <hr className="my-10 border-border/60" />,
  strong: (props: ComponentProps<"strong">) => (
    <strong className="font-medium text-foreground">{props.children}</strong>
  ),
} as const;
