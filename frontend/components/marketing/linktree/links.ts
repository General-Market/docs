export type LinktreeIcon = 'x' | 'discord' | 'docs' | 'waitlist'

export type LinktreeEntry = {
  label: string
  href: string
  icon: LinktreeIcon
  external?: boolean
}

export const LINKTREE_ENTRIES: LinktreeEntry[] = [
  { label: 'Join the waitlist', href: '/waitlist', icon: 'waitlist' },
  { label: 'Follow on X', href: 'https://x.com/otc_max', icon: 'x', external: true },
  { label: 'Discord community', href: 'https://discord.gg/xsfgzwR6', icon: 'discord', external: true },
  { label: 'Read the docs', href: 'https://docs.generalmarket.io', icon: 'docs', external: true },
]
