/**
 * @file Running a chat: sends the conversation to the model with the notes
 * tools, runs the tools it asks for, sends their results back, and repeats
 * until it answers in words. Looking (reading, searching) runs straight
 * away; a change waits for the user to allow it, unless they allowed changes
 * for the whole chat.
 */
import { useCampaigns } from '../../campaigns/campaignStore';
import { useNotebook } from '../../lorekeeper/state/notebookStore';
import { useUi as useLorekeeperUi } from '../../lorekeeper/state/uiStore';
import { INSTRUCTIONS } from '../mcpServer';
import { chat } from '../models/clients';
import { ModelError, type ChatMessage, type ToolCall, type ToolResult, type ToolSpec } from '../models/types';
import { NOTES_TOOLS, ToolError } from '../notesTools';
import { useChats } from './chats';
import { currentConnection } from './settings';

/** Most rounds of tool calls in one answer, so a confused model can't loop forever. */
const MAX_ROUNDS = 15;

const TOOL_SPECS: ToolSpec[] = NOTES_TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.inputSchema }));

let controller: AbortController | null = null;

/** What the model is told: how the notes work, plus where the user is. */
function systemPrompt(): string {
  const { campaigns, activeId } = useCampaigns.getState();
  const campaign = campaigns.find((c) => c.id === activeId);
  const pageId = useLorekeeperUi.getState().selectedPageId;
  const page = useNotebook.getState().pages.find((p) => p.id === pageId);
  const context = [
    `You are the assistant inside Dungeon Books, helping the user with their campaign "${campaign?.name ?? ''}".`,
    page ? `The page open in their notes right now is "${page.title}"; "this page" means it.` : '',
    'Answer in plain Markdown. Be concise.',
  ];
  return `${INSTRUCTIONS}\n\n${context.filter(Boolean).join(' ')}`;
}

/** Waits for the user to allow or skip a change. */
function askToChange(chatId: string, call: ToolCall): Promise<boolean> {
  return new Promise((resolve) => {
    useChats.setState({
      pending: {
        chatId,
        call,
        decide: (allow) => {
          useChats.setState({ pending: null });
          resolve(allow);
        },
      },
    });
  });
}

/** Runs one tool call, asking first when it changes the notes. */
async function runCall(chatId: string, campaignId: string, call: ToolCall): Promise<ToolResult> {
  const result = (text: string, isError = false): ToolResult => ({ callId: call.id, name: call.name, text, isError });
  const tool = NOTES_TOOLS.find((t) => t.name === call.name);
  if (!tool) return result(`There is no tool called ${call.name}.`, true);
  if (!call.args) return result(`The arguments for ${call.name} weren't a JSON object: ${call.rawArgs.slice(0, 200)}`, true);
  // The tools work on whichever campaign is open; a chat about another one mustn't touch it.
  if (useCampaigns.getState().activeId !== campaignId) return result('This chat belongs to a campaign that is no longer open in Dungeon Books.', true);
  const chat = useChats.getState().chats.find((c) => c.id === chatId);
  if (!tool.readOnly && !chat?.allowChanges && !(await askToChange(chatId, call))) {
    return result('The user did not allow this change. Ask them what they would like instead.', true);
  }
  try {
    return result(tool.run(call.args));
  } catch (e) {
    return result(e instanceof ToolError ? e.message : `Something went wrong: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}

/** Sends the user's message in a chat and lets the model answer, using tools as it needs. */
export async function sendMessage(chatId: string, text: string): Promise<void> {
  const chats = useChats.getState();
  const connection = currentConnection();
  if (chats.runningChatId) return;
  if (!connection?.model) {
    useChats.setState({ error: 'Choose a model first (Models, on the left).' });
    return;
  }
  const campaignId = chats.chats.find((c) => c.id === chatId)?.campaignId;
  if (!campaignId) return;

  chats.append(chatId, { role: 'user', text });
  controller = new AbortController();
  const signal = controller.signal;
  useChats.setState({ runningChatId: chatId, streamingText: '', error: null });
  const messages = (): ChatMessage[] => useChats.getState().chats.find((c) => c.id === chatId)?.messages ?? [];

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const reply = await chat({
        connection,
        model: connection.model,
        system: systemPrompt(),
        messages: messages(),
        tools: TOOL_SPECS,
        signal,
        onText: (piece) => useChats.setState((s) => ({ streamingText: s.streamingText + piece })),
      });
      useChats.setState({ streamingText: '' });
      useChats.getState().append(chatId, { role: 'assistant', text: reply.text, toolCalls: reply.toolCalls });
      if (!reply.toolCalls.length) return;
      const results: ToolResult[] = [];
      for (const call of reply.toolCalls) {
        if (signal.aborted) results.push({ callId: call.id, name: call.name, text: 'Stopped by the user.', isError: true });
        else results.push(await runCall(chatId, campaignId, call));
      }
      useChats.getState().append(chatId, { role: 'tool', results });
      if (signal.aborted) return;
    }
    useChats.setState({ error: `Stopped after ${MAX_ROUNDS} rounds of tool use.` });
  } catch (e) {
    if (signal.aborted) return;
    useChats.setState({ error: e instanceof ModelError ? e.message : `Something went wrong: ${e instanceof Error ? e.message : String(e)}` });
  } finally {
    const partial = useChats.getState().streamingText;
    // Keep what had streamed in before a stop or an error.
    if (partial) useChats.getState().append(chatId, { role: 'assistant', text: partial, toolCalls: [] });
    useChats.setState({ runningChatId: null, streamingText: '' });
    controller = null;
  }
}

/** Stops the answer in progress (a change waiting for approval is skipped). */
export function stopAnswer() {
  controller?.abort();
  useChats.getState().pending?.decide(false);
}
