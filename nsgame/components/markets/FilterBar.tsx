// Type-only module. The FilterBar component is gone — the left sidebar
// owns board and status now. These two types remain because NavBar,
// CategorySidebar, MarketList and MobileMenu still spell them.

export type BoardFilter = 'all' | 'stars' | 'cams'

/**
 * Legacy alias — NavBar's source tabs aren't wired anymore but the type
 * still satisfies the import.
 */
export type SourceFilter = 'all' | 1 | 2 | 3 | 4 | 5
