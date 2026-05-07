export type LinktreeIcon = 'x' | 'discord' | 'docs' | 'waitlist'

export type LinktreeEntry = {
  label: string
  href: string
  icon: LinktreeIcon
  external?: boolean
  featured?: boolean
  kicker?: string
}

export const LINKTREE_ENTRIES: LinktreeEntry[] = [
  {
    label: 'Join the waitlist',
    href: '/waitlist',
    icon: 'waitlist',
    featured: true,
    kicker: 'Early access',
  },
  { label: 'Follow on X', href: 'https://x.com/tryGeneral_', icon: 'x', external: true },
  { label: 'Discord community', href: 'https://discord.gg/QbasycShP', icon: 'discord', external: true },
  { label: 'Read the docs', href: '/docs', icon: 'docs' },
]
