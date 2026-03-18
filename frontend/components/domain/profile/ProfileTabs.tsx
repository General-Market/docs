'use client'

import { SpringTabs, SpringTab } from '@/components/ui/spring'

interface ProfileTabsProps {
  activeTab: 'vision' | 'index'
  onTabChange: (tab: 'vision' | 'index') => void
}

export function ProfileTabs({ activeTab, onTabChange }: ProfileTabsProps) {
  const tabs = [
    { id: 'vision' as const, label: 'Vision' },
    { id: 'index' as const, label: 'Index' },
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
              className="px-6 py-3 text-body font-semibold transition-all"
              activeClass="text-black"
              inactiveClass="text-text-secondary hover:text-black"
              layoutId="profile-tab-indicator"
            >
              {tab.label}
            </SpringTab>
          ))}
        </SpringTabs>
      </div>
    </div>
  )
}
