'use client'

import { PageSection } from '@/components/layout/PageSection'

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
      <PageSection as="div">
        <div className="flex items-center gap-0 animate-fade-in">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-6 py-3 text-body font-semibold transition-colors border-b-[3px] press ${
                activeTab === tab.id
                  ? 'text-black border-black'
                  : 'text-text-secondary border-transparent hover:text-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </PageSection>
    </div>
  )
}
