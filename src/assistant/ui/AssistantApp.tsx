/**
 * @file The Assistant tab: chats with an AI model about the open campaign's
 * notes, and the Models screen for connecting model servers. The chat list
 * sits on the left; on a phone the list and the open chat take turns.
 */
import { MessageSquarePlus, Server, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useActiveCampaign } from '../../campaigns/campaignStore';
import { hasCustomTitleBar } from '../../platform';
import { usePhoneLayout } from '../../lorekeeper/ui/common/usePhoneLayout';
import { AiConnectButton } from '../../shell/AiConnect';
import { SettingsButton } from '../../shell/Settings';
import { CampaignMenu } from '../../shell/CampaignMenu';
import { TabSwitcher } from '../../shell/TabSwitcher';
import { WindowControls } from '../../shell/WindowControls';
import { useChats } from '../chat/chats';
import { useAssistantSettings } from '../chat/settings';
import { ChatView } from './ChatView';
import { ModelsView } from './ModelsView';
import './assistant.css';

const customTitleBar = hasCustomTitleBar();

/** What the right side shows. */
type View = 'chat' | 'models';

function TopBar() {
  const drag = customTitleBar ? { 'data-tauri-drag-region': true } : {};
  return (
    <header className={`top-bar${customTitleBar ? ' title-bar' : ''}`} {...drag}>
      <TabSwitcher />
      <CampaignMenu />
      <span className="spacer" {...drag} />
      <AiConnectButton />
      <SettingsButton />
      {customTitleBar && <WindowControls />}
    </header>
  );
}

/** The open campaign's chats, newest first, with New chat and Models. */
function ChatList({ view, show }: { view: View; show: (view: View) => void }) {
  const campaign = useActiveCampaign();
  const chats = useChats((s) => s.chats.filter((c) => c.campaignId === campaign?.id).sort((a, b) => b.updatedAt - a.updatedAt));
  const openId = useChats((s) => s.openChatId);
  const hasConnection = useAssistantSettings((s) => s.connections.length > 0);

  return (
    <aside className="assistant-list">
      <div className="assistant-list-actions">
        <button
          className="primary"
          disabled={!campaign}
          onClick={() => {
            useChats.getState().newChat(campaign!.id);
            show('chat');
          }}
        >
          <MessageSquarePlus size={16} /> New chat
        </button>
        <button className={view === 'models' ? 'active' : undefined} onClick={() => show('models')} title="Connect model servers">
          <Server size={16} /> Models{!hasConnection && <span className="assistant-dot" />}
        </button>
      </div>
      <div className="assistant-chats">
        {chats.length === 0 && <p className="muted assistant-empty">No chats about this campaign yet.</p>}
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`assistant-chat-row${chat.id === openId && view === 'chat' ? ' selected' : ''}`}
            onClick={() => {
              useChats.getState().open(chat.id);
              show('chat');
            }}
          >
            <span className="assistant-chat-title">{chat.title}</span>
            <button
              className="icon"
              title="Delete chat"
              onClick={(e) => {
                e.stopPropagation();
                useChats.getState().remove(chat.id);
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

/** The whole tab. */
export function AssistantApp() {
  const hasConnection = useAssistantSettings((s) => s.connections.length > 0);
  // With nothing connected yet, start where connecting happens.
  const [view, setView] = useState<View>(hasConnection ? 'chat' : 'models');
  const [listOpen, setListOpen] = useState(true);
  const phone = usePhoneLayout();
  const show = (next: View) => {
    setView(next);
    setListOpen(false);
  };
  const back = () => setListOpen(true);
  const showList = !phone || listOpen;
  const showMain = !phone || !listOpen;

  return (
    <div className="app">
      <TopBar />
      <div className="assistant-workspace">
        {showList && <ChatList view={view} show={show} />}
        {showMain && (
          <main className="assistant-main">
            {view === 'models' ? <ModelsView done={() => show('chat')} back={phone ? back : undefined} /> : <ChatView back={phone ? back : undefined} showModels={() => show('models')} />}
          </main>
        )}
      </div>
    </div>
  );
}
