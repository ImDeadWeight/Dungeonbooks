/**
 * @file The Encounters / Lorekeeper switch at the start of each tab's top
 * bar, where each app showed its name.
 */
import { BookOpen, Swords } from 'lucide-react';
import { showTab, useTabs, type Tab } from '../bridge/navigation';

/** The tabs, in the order they're shown. */
const TABS: { tab: Tab; label: string; Icon: typeof Swords }[] = [
  { tab: 'encounters', label: 'Encounters', Icon: Swords },
  { tab: 'lorekeeper', label: 'Lorekeeper', Icon: BookOpen },
];

/** Two buttons; the showing tab's is highlighted. On a phone only the icons show. */
export function TabSwitcher() {
  const current = useTabs((s) => s.tab);
  return (
    <div className="tab-switcher" role="tablist">
      {TABS.map(({ tab, label, Icon }) => (
        <button
          key={tab}
          role="tab"
          aria-selected={tab === current}
          className={tab === current ? 'active' : undefined}
          title={label}
          onClick={() => showTab(tab)}
        >
          <Icon size={16} /> <span className="tab-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
