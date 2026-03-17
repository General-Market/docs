import { type ReactNode } from 'react'

interface PageSectionProps {
  children: ReactNode
  className?: string
  /** Use 'wide' for 1400px max-width, default is 1280px */
  width?: 'default' | 'wide'
  /** HTML id for scroll targeting */
  id?: string
  /** Render as <section> (default) or <div> */
  as?: 'section' | 'div'
  /** Extra HTML attributes forwarded to the root element */
  [key: `data-${string}`]: string | boolean | undefined
}

/**
 * Consistent page-section wrapper.
 * Replaces the repeated px-6 lg:px-12 > max-w-site mx-auto pattern.
 */
export function PageSection({
  children,
  className = '',
  width = 'default',
  id,
  as: Tag = 'section',
  ...rest
}: PageSectionProps) {
  const maxW = width === 'wide' ? 'max-w-site-wide' : 'max-w-site'
  return (
    <Tag id={id} className={className} {...rest}>
      <div className="px-6 lg:px-12">
        <div className={`${maxW} mx-auto`}>
          {children}
        </div>
      </div>
    </Tag>
  )
}
