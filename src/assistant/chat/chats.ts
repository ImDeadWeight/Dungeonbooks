/**
 * @file The assistant's chats, each about one campaign's notes, saved in the
 * assistant's chats document; and what is happening right now (an answer
 * streaming in, a change waiting for the user's say-so), which is not saved.
 */
import { create } from 'zustand';
import type { ChatMessage, ToolCall } from '../models/types';
import { assistantDocuments } from './settings';

const CHATS_DOC = 'chats';
/** Characters of the first message used as a new chat's title. */
const TITLE_LENGTH = 48;

/** One chat. */
export interface Chat {
  id: string;
  /** The campaign whose notes it works on. */
  campaignId: string;
  title: string;
  /** Last change (ms since 1970), for ordering the list. */
  updatedAt: number;
  messages: ChatMessage[];
  /** The user said changes need no asking for the rest of this chat. */
  allowChanges?: boolean;
}

/** A change the model wants to make, waiting for Allow or Skip. */
export interface PendingChange {
  chatId: string;
  call: ToolCall;
  decide(allow: boolean): void;
}

interface ChatsState {
  chats: Chat[];
  openChatId: string | null;
  /** The chat a model is answering in, if any. */
  runningChatId: string | null;
  /** The answer's text so far, while it streams in. */
  streamingText: string;
  pending: PendingChange | null;
  /** The last problem in the open chat (a server that can't be reached, a refused key). */
  error: string | null;
  /** Starts a new chat in a campaign and opens it. */
  newChat(campaignId: string): string;
  open(id: string | null): void;
  /** Adds a message to a chat (the first user message also names it). */
  append(chatId: string, message: ChatMessage): void;
  update(chatId: string, changes: Partial<Pick<Chat, 'title' | 'allowChanges'>>): void;
  remove(id: string): void;
}

export const useChats = create<ChatsState>((set, get) => ({
  chats: [],
  openChatId: null,
  runningChatId: null,
  streamingText: '',
  pending: null,
  error: null,

  newChat(campaignId) {
    const chat: Chat = { id: crypto.randomUUID(), campaignId, title: 'New chat', updatedAt: Date.now(), messages: [] };
    set((s) => ({ chats: [chat, ...s.chats], openChatId: chat.id, error: null }));
    return chat.id;
  },

  open(id) {
    set({ openChatId: id, error: null });
  },

  append(chatId, message) {
    set((s) => ({
      chats: s.chats.map((c) => {
        if (c.id !== chatId) return c;
        const first = message.role === 'user' && !c.messages.some((m) => m.role === 'user');
        const title = first ? message.text.replace(/\s+/g, ' ').trim().slice(0, TITLE_LENGTH) || c.title : c.title;
        return { ...c, title, updatedAt: Date.now(), messages: [...c.messages, message] };
      }),
    }));
  },

  update(chatId, changes) {
    set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? { ...c, ...changes } : c)) }));
  },

  remove(id) {
    set((s) => ({ chats: s.chats.filter((c) => c.id !== id), openChatId: s.openChatId === id ? null : s.openChatId }));
    if (get().runningChatId === id) get().pending?.decide(false);
  },
}));

/** Loads the chats, then saves them whenever they change (not while text streams in). */
export async function startChats(): Promise<void> {
  const loaded = await assistantDocuments.loadDocument<{ chats: Chat[] }>(CHATS_DOC, () => ({ chats: [] }));
  useChats.setState({ chats: Array.isArray(loaded.data.chats) ? loaded.data.chats : [] });
  useChats.subscribe((s, before) => {
    if (s.chats !== before.chats) assistantDocuments.saveDocument(CHATS_DOC, { chats: s.chats }).catch(() => undefined);
  });
}
