/**
 * @file Root layout: top bar, sidebar and the open page, plus the floating
 * peek panel, confirmation dialog and error notices. On a phone the sidebar
 * and the page take turns filling the screen (see phone.css).
 */
// Before every component's styles, as main.tsx loaded it in the separate app.
import '../styles/layout.css';
import { useUi } from '../state/uiStore';
import { ConfirmDialog } from './common/ConfirmDialog';
import { ErrorNotices } from './common/ErrorNotices';
import { PageView } from './page/PageView';
import { PeekPanel } from './peek/PeekPanel';
import { SetPageTypeDialog } from './sidebar/SetPageTypeDialog';
import { Sidebar } from './sidebar/Sidebar';
import { TopBar } from './TopBar';
// After every component's styles, so touch mode and the phone layout can override them.
import '../styles/touch.css';
import '../styles/phone.css';

/** The Lorekeeper tab. */
export function App() {
  const sidebarOpen = useUi((s) => !s.sidebarCollapsed);
  return (
    <div className="app">
      <TopBar />
      <div className={`workspace${sidebarOpen ? ' sidebar-open' : ''}`}>
        <Sidebar />
        <PageView />
      </div>
      <PeekPanel />
      <SetPageTypeDialog />
      <ConfirmDialog />
      <ErrorNotices />
    </div>
  );
}
