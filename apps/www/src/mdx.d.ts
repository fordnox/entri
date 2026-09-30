declare module '*.mdx' {
  import type { ComponentType } from 'react'

  export const frontmatter: {
    title: string
    description: string
    kicker: string
  }

  const Component: ComponentType<{ components?: Record<string, ComponentType<unknown>> }>
  export default Component
}
