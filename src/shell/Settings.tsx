/**
 * @file The Settings button and dialog: a tab per section. Assistant: what
 * the Assistant tab's model may change in the notes. AI apps (desktop app):
 * connecting apps like Claude, and what they may change. AI changes: what
 * they changed, with Undo.
 */
import { Settings as SettingsIcon } from 'lucide-react';
import { useAssistantSettings, type AppPermission, type ChatPermission } from '../assistant/chat/settings';
import { aiConnectionsAvailable } from '../assistant/connection';
import { ALL_TOOLS } from '../assistant/tools';
import { Modal } from '../ui/Modal';
import { AiAppsSettings } from './AiConnect';
import { AiChangesList } from './aiChanges/AiChangesList';
import { closeSettings, openSettings, useSettingsDialog, type SettingsSection } from './settingsDialog';
import './settings.css';

/** The tools that change the notes, each set on its own. */
const CHANGES = ALL_TOOLS.filter((t) => !t.readOnly);

const CHAT_CHOICES: { value: ChatPermission; label: string }[] = [
  { value: 'ask', label: 'Ask first' },
  { value: 'allow', label: 'Allow' },
  { value: 'never', label: 'Never' },
];

const APP_CHOICES: { value: AppPermission; label: string }[] = [
  { value: 'allow', label: 'Allow' },
  { value: 'never', label: 'Never' },
];

/** A row per kind of change, with a choice for each; the header sets them all at once. */
function PermissionTable<T extends string>({
  choices,
  value,
  set,
}: {
  choices: { value: T; label: string }[];
  value: (tool: string) => T;
  set: (tool: string, value: T) => void;
}) {
  const all = CHANGES.every((t) => value(t.name) === value(CHANGES[0].name)) ? value(CHANGES[0].name) : null;
  return (
    <div className="settings-permissions">
      <div className="settings-permission all">
        <span>All changes</span>
        <Choices choices={choices} value={all} set={(v) => CHANGES.forEach((t) => set(t.name, v))} />
      </div>
      {CHANGES.map((tool) => (
        <div key={tool.name} className="settings-permission">
          <span>{tool.title}</span>
          <Choices choices={choices} value={value(tool.name)} set={(v) => set(tool.name, v)} />
        </div>
      ))}
    </div>
  );
}

/** Buttons side by side, the chosen one lit; none lit when `value` is null (a mix). */
function Choices<T extends string>({ choices, value, set }: { choices: { value: T; label: string }[]; value: T | null; set: (value: T) => void }) {
  return (
    <div className="settings-choices" role="radiogroup">
      {choices.map((c) => (
        <button key={c.value} role="radio" aria-checked={c.value === value} className={c.value === value ? 'active' : undefined} onClick={() => set(c.value)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

function AssistantSection() {
  const chat = useAssistantSettings((s) => s.permissions.chat);
  return (
    <>
      <h3>What the model may change</h3>
      <p className="muted">
        For the chats in the Assistant tab. Reading and searching the notes is always allowed. "Ask first" shows
        each change for you to allow or skip; "Never" doesn't offer it to the model at all. Each change can be
        undone, from the chat or from AI changes.
      </p>
      <PermissionTable choices={CHAT_CHOICES} value={(tool) => chat[tool] ?? 'ask'} set={(tool, v) => useAssistantSettings.getState().setChatPermission(tool, v)} />
    </>
  );
}

function AiAppsSection() {
  const apps = useAssistantSettings((s) => s.permissions.apps);
  return (
    <AiAppsSettings>
      <h3>What AI apps may change</h3>
      <p className="muted">AI apps can't be asked first, so each change is allowed or not. "Never" hides it from them.</p>
      <PermissionTable choices={APP_CHOICES} value={(tool) => apps[tool] ?? 'allow'} set={(tool, v) => useAssistantSettings.getState().setAppPermission(tool, v)} />
    </AiAppsSettings>
  );
}

/** The sections this device has (AI apps connect to the desktop app only). */
const sections = (): { id: SettingsSection; label: string }[] => [
  { id: 'assistant', label: 'Assistant' },
  ...(aiConnectionsAvailable() ? [{ id: 'ai-apps' as const, label: 'AI apps' }] : []),
  { id: 'ai-changes', label: 'AI changes' },
];

const SECTIONS: Record<SettingsSection, () => JSX.Element> = {
  assistant: AssistantSection,
  'ai-apps': AiAppsSection,
  'ai-changes': AiChangesList,
};

/** The dialog, while it is open; drawn once, by the shell. */
export function SettingsDialog() {
  const section = useSettingsDialog((s) => s.section);
  if (!section) return null;
  const Section = SECTIONS[section];
  return (
    <Modal title="Settings" size="medium" onClose={closeSettings} footer={<button onClick={closeSettings}>Done</button>}>
      <div className="settings">
        <div className="settings-tabs" role="tablist">
          {sections().map((s) => (
            <button key={s.id} role="tab" aria-selected={s.id === section} className={s.id === section ? 'active' : undefined} onClick={() => openSettings(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="settings-section">
          <Section />
        </div>
      </div>
    </Modal>
  );
}

/** Top bar button that opens Settings. */
export function SettingsButton() {
  return (
    <button className="icon" title="Settings" onClick={() => openSettings('assistant')}>
      <SettingsIcon size={18} />
    </button>
  );
}
