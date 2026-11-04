/**
 * @file Whether the Settings dialog is open, and at which section. Every
 * tab's top bar can open it; the shell draws it once.
 */
import { create } from 'zustand';

/** The dialog's sections, one tab each. */
export type SettingsSection = 'assistant' | 'ai-apps' | 'ai-changes';

export const useSettingsDialog = create<{ section: SettingsSection | null }>(() => ({ section: null }));

/** Opens Settings at a section. */
export const openSettings = (section: SettingsSection) => useSettingsDialog.setState({ section });

export const closeSettings = () => useSettingsDialog.setState({ section: null });
