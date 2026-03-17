'use client'

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
        <div className="max-w-site mx-auto flex items-center gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-6 py-3 text-[14px] font-semibold transition-all border-b-[3px] ${
                activeTab === tab.id
                  ? 'text-black border-black'
                  : 'text-text-secondary border-transparent hover:text-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
