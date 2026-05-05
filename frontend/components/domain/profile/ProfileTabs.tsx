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
    <div style={{ borderBottom: '1px solid var(--apple-border)' }}>
      <div className="px-6 lg:px-12">
        <SpringTabs className="max-w-site mx-auto flex items-center gap-0">
          {tabs.map((tab) => (
            <SpringTab
              key={tab.id}
              isActive={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className="transition-all"
              activeClass=""
              inactiveClass=""
              layoutId="profile-tab-indicator"
            >
              <span
                className="flex items-center gap-2"
                style={{
                  padding: '14px 20px',
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 'var(--apple-fs-14)',
                  fontWeight: 500,
                  letterSpacing: 'var(--apple-track-mid)',
                  color:
                    activeTab === tab.id
                      ? 'var(--apple-text)'
                      : 'var(--apple-text-secondary)',
                }}
              >
                <span>{tab.label}</span>
                {tab.count > 0 ? (
                  <span
                    style={{
                      background:
                        activeTab === tab.id
                          ? 'var(--apple-text)'
                          : 'rgb(52,199,89)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: 'var(--apple-track-loose)',
                      borderRadius: 'var(--apple-r-pill)',
                      padding: '2px 8px',
                      minWidth: 22,
                      textAlign: 'center',
                    }}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </span>
            </SpringTab>
          ))}
        </SpringTabs>
      </div>
    </div>
  )
}
