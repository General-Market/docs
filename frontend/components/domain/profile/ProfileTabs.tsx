'use client'

import { useTranslations } from 'next-intl'
import { SpringTabs, SpringTab } from '@/components/ui/spring'

export type ProfileTabId = 'vision' | 'index' | 'vaults'

interface ProfileTabsProps {
  activeTab: ProfileTabId
  onTabChange: (tab: ProfileTabId) => void
  /** Number of Vision batches this wallet has joined — surfaced as a badge. */
  visionCount?: number
}

export function ProfileTabs({
  activeTab,
  onTabChange,
  visionCount = 0,
}: ProfileTabsProps) {
  const t = useTranslations('common')

  const tabs = [
    { id: 'vaults' as const, label: t('profile.tab_vaults'), count: 0 },
    { id: 'vision' as const, label: t('profile.tab_vision'), count: visionCount },
    { id: 'index' as const, label: t('profile.tab_index'), count: 0 },
  ]

  return (
    <div className="border-b border-border-light">
      <div className="px-6 lg:px-12">
        <SpringTabs className="max-w-site mx-auto flex items-center gap-0">
          {tabs.map((tab) => (
            <SpringTab
              key={tab.id}
              isActive={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className="px-6 py-3 text-body font-semibold transition-all flex items-center gap-2"
              activeClass="text-black"
              inactiveClass="text-text-secondary hover:text-black"
              layoutId="profile-tab-indicator"
            >
              <span>{tab.label}</span>
              {tab.count > 0 ? (
                <span
                  className={
                    activeTab === tab.id
                      ? 'bg-black text-white text-caption font-semibold rounded-full px-2 py-0.5 min-w-[22px] text-center'
                      : 'bg-color-up text-white text-caption font-semibold rounded-full px-2 py-0.5 min-w-[22px] text-center'
                  }
                >
                  {tab.count}
                </span>
              ) : null}
            </SpringTab>
          ))}
        </SpringTabs>
      </div>
    </div>
  )
}
