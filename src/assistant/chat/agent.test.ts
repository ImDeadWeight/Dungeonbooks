import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCampaigns } from '../../campaigns/campaignStore';
import { useNotebook } from '../../lorekeeper/state/notebookStore';
import { cleanTitle, sendMessage } from './agent';
import { useChats } from './chats';
import { useAssistantSettings } from './settings';

/** A streamed answer made of server-sent events. */
function stream(events: object[], done = true): Response {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + (done ? 'data: [DONE]\n\n' : '');
  return new Response(new Blob([text]).stream(), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/** Answers model requests in turn, keeping what was sent. */
function fakeServer(...answers: Response[]) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) });
      return answers.shift()!;
    }),
  );
  return sent;
}

let chatId = '';
const chat = () => useChats.getState().chats.find((c) => c.id === chatId)!;

beforeEach(() => {
  useCampaigns.setState({ campaigns: [{ id: 'c1', name: 'Veilstrand', formatId: null }], activeId: 'c1' });
  useNotebook.getState().replaceAll({ folders: [], pages: [] });
  useNotebook.getState().addPage(null, 'Mira Thorne');
  useChats.setState({ chats: [], pending: null, error: null, runningChatId: null });
  useAssistantSettings.setState({ permissions: { chat: {}, apps: {} } });
  chatId = useChats.getState().newChat('c1');
});

afterEach(() => vi.unstubAllGlobals());

describe('the assistant with an OpenAI-style server', () => {
  beforeEach(() => {
    useAssistantSettings.setState({ connections: [{ id: 'o', kind: 'openai-compatible', name: 'Ollama', baseUrl: 'http://127.0.0.1:11434', model: 'qwen' }], currentId: 'o' });
  });

  it('runs a reading tool straight away and sends the result back', async () => {
    const sent = fakeServer(
      stream([
        { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call1', function: { name: 'read_page', arguments: '{"page":' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"Mira Thorne"}' } }] } }] },
      ]),
      stream([{ choices: [{ delta: { content: 'Mira has ' } }] }, { choices: [{ delta: { content: 'no notes yet.' } }] }]),
    );
    await sendMessage(chatId, 'What do we know about Mira?');

    expect(sent[0].url).toBe('http://127.0.0.1:11434/v1/chat/completions');
    expect((sent[0].body.tools as unknown[]).length).toBeGreaterThan(5);
    const toolMessage = (sent[1].body.messages as { role: string; content: string }[]).find((m) => m.role === 'tool')!;
    expect(toolMessage.content).toContain('# Mira Thorne');
    expect(chat().messages[chat().messages.length - 1]).toEqual({ role: 'assistant', text: 'Mira has no notes yet.', toolCalls: [] });
    expect(chat().title).toBe('What do we know about Mira?');
  });

  it('asks before a change, and tells the model when it was skipped', async () => {
    fakeServer(
      stream([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'add_text', arguments: '{"page":"Mira Thorne","text":"A smuggler."}' } }] } }] }]),
      stream([{ choices: [{ delta: { content: 'OK, I left it.' } }] }]),
    );
    const done = sendMessage(chatId, 'Add that she is a smuggler');
    await vi.waitFor(() => expect(useChats.getState().pending).not.toBeNull());
    expect(useChats.getState().pending!.call.args).toEqual({ page: 'Mira Thorne', text: 'A smuggler.' });
    useChats.getState().pending!.decide(false);
    await done;
    expect(useNotebook.getState().pages[0].boxes).toEqual([]);
    const results = chat().messages.find((m) => m.role === 'tool');
    expect(results).toMatchObject({ results: [{ isError: true, text: expect.stringContaining('did not allow') }] });
  });

  it('makes an allowed change, and stops asking once changes are allowed for the chat', async () => {
    useChats.getState().update(chatId, { allowChanges: true });
    fakeServer(
      stream([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'add_text', arguments: '{"page":"Mira Thorne","text":"A smuggler."}' } }] } }] }]),
      stream([{ choices: [{ delta: { content: 'Done.' } }] }]),
    );
    await sendMessage(chatId, 'Add that she is a smuggler');
    expect(useNotebook.getState().pages[0].boxes).toHaveLength(1);
  });

  it('has the model name the chat after its first answer, and again a little later', async () => {
    const answer = (text: string) => stream([{ choices: [{ delta: { content: text } }] }]);
    const sent = fakeServer(answer('Mira is a smuggler.'), answer('**"Mira the Smuggler."**'));
    await sendMessage(chatId, 'Who is Mira?');
    expect(sent[1].body.tools).toBeUndefined();
    expect((sent[1].body.messages as { content: string }[])[1].content).toContain('User: Who is Mira?');
    expect(chat().title).toBe('Mira the Smuggler');

    fakeServer(answer('She works the docks.'));
    await sendMessage(chatId, 'Where?');
    expect(chat().title).toBe('Mira the Smuggler');

    const later = fakeServer(answer('At night.'), answer('Mira on the Docks'));
    await sendMessage(chatId, 'When?');
    expect(later).toHaveLength(2);
    expect(chat().title).toBe('Mira on the Docks');
  });

    it('makes a change without asking when Settings allow it, and never offers one Settings forbid', async () => {
    useAssistantSettings.getState().setChatPermission('add_text', 'allow');
    useAssistantSettings.getState().setChatPermission('replace_text', 'never');
    const sent = fakeServer(
      stream([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'add_text', arguments: '{"page":"Mira Thorne","text":"A smuggler."}' } }] } }] }]),
      stream([{ choices: [{ delta: { content: 'Done.' } }] }]),
    );
    await sendMessage(chatId, 'Add that she is a smuggler');
    expect(useChats.getState().pending).toBeNull();
    expect(useNotebook.getState().pages[0].boxes).toHaveLength(1);
    const offered = (sent[0].body.tools as { function: { name: string } }[]).map((t) => t.function.name);
    expect(offered).toContain('add_text');
    expect(offered).not.toContain('replace_text');
  });

    it('says so when the server is not running', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('connection refused'))));
    await sendMessage(chatId, 'Hello');
    expect(useChats.getState().error).toBe("Couldn't reach Ollama at http://127.0.0.1:11434. Is it running?");
  });
});

describe('the assistant with Anthropic', () => {
  it('sends tools and results in Anthropic form', async () => {
    useAssistantSettings.setState({
      connections: [{ id: 'a', kind: 'anthropic', name: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com', apiKey: 'k', model: 'claude-x' }],
      currentId: 'a',
    });
    const sent = fakeServer(
      stream(
        [
          { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
          { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Looking.' } },
          { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu1', name: 'get_overview' } },
          { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{}' } },
          { type: 'message_stop' },
        ],
        false,
      ),
      stream([{ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'One page.' } }], false),
    );
    await sendMessage(chatId, 'How many pages?');

    expect(sent[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(sent[0].body.system).toContain('Dungeon Books');
    const [, assistant, results] = sent[1].body.messages as { role: string; content: { type: string; tool_use_id?: string }[] }[];
    expect(assistant.content.map((b) => b.type)).toEqual(['text', 'tool_use']);
    expect(results).toMatchObject({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1' }] });
    expect(chat().messages[chat().messages.length - 1]).toMatchObject({ text: 'One page.' });
  });
});

describe('chat titles from the model', () => {
  it('drops thinking, quotes, Markdown and a "Title:" label', () => {
    expect(cleanTitle('<think>The user asks about factions.</think>\n\nTitle: "Faction Politics"')).toBe('Faction Politics');
    expect(cleanTitle('## *The Everstorm Hook.*\nMore words')).toBe('The Everstorm Hook');
    expect(cleanTitle('<think>still going')).toBe('');
  });
});
