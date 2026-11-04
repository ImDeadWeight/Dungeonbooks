import { beforeEach, describe, expect, it } from 'vitest';
import { useNotebook } from '../lorekeeper/state/notebookStore';
import { useAssistantSettings } from './chat/settings';
import { handleMcpBody } from './mcpServer';

let nextId = 1;
/** Sends one request and returns its result (or error). */
function send(method: string, params?: object) {
  const reply = JSON.parse(handleMcpBody(JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }), '1.0'));
  return reply.result ?? reply.error;
}
/** Calls a tool; returns [text, isError]. */
function call(name: string, args: object = {}) {
  const result = send('tools/call', { name, arguments: args });
  return [result.content[0].text as string, result.isError as boolean] as const;
}

const page = (title: string) => useNotebook.getState().pages.find((p) => p.title === title)!;

beforeEach(() => {
  useNotebook.getState().replaceAll({ folders: [], pages: [] });
  useAssistantSettings.setState({ permissions: { chat: {}, apps: {} } });
});

describe('MCP server', () => {
  it('does the handshake and lists tools', () => {
    const init = send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    expect(init.protocolVersion).toBe('2025-06-18');
    expect(init.instructions).toContain('[[Page Title]]');
    expect(handleMcpBody(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), '1.0')).toBe('');
    expect(send('tools/list').tools.map((t: { name: string }) => t.name)).toContain('create_page');
  });

  it('hides and refuses changes Settings forbid AI apps', () => {
    useAssistantSettings.getState().setAppPermission('create_page', 'never');
    const names = send('tools/list').tools.map((t: { name: string }) => t.name);
    expect(names).not.toContain('create_page');
    expect(names).toContain('add_text');
    const [text, isError] = call('create_page', { title: 'Mira Thorne' });
    expect(isError).toBe(true);
    expect(text).toContain('Settings');
    expect(useNotebook.getState().pages).toEqual([]);
  });

  it('answers unknown methods with an error', () => {
    expect(send('resources/list').code).toBe(-32601);
  });

  it('creates pages in folders with types and linked text, then reads them back', () => {
    expect(call('create_page', { title: 'Mira Thorne', folder: 'People/NPCs', type: 'character', aliases: ['Thorny'] })[1]).toBe(false);
    const [created] = call('create_page', { title: 'Session 1', text: 'We met [[thorny]] and [[Brannoc]].' });
    expect(created).toContain('"Brannoc"');

    const [read] = call('read_page', { page: 'session 1' });
    expect(read).toContain('We met [[Mira Thorne|thorny]] and Brannoc.');
    expect(call('get_overview')[0]).toContain('People/\n  NPCs/\n    - Mira Thorne (Character (NPC); also called Thorny; empty)\n- Session 1 (Note)');
  });

  it('adds and replaces boxes, and links mentions', () => {
    call('create_page', { title: 'Everstorm', type: 'place' });
    call('create_page', { title: 'Log', text: 'First.' });
    expect(call('add_text', { page: 'Log', text: 'The Everstorm grew.' })[0]).toBe('Added text box 2 to "Log".');
    const log = page('Log');
    expect(log.boxes[1].y).toBeGreaterThan(log.boxes[0].y);

    expect(call('link_mentions', { page: 'Log' })[0]).toContain('"Everstorm"');
    expect(call('read_page', { page: 'Log' })[0]).toContain('The [[Everstorm]] grew.');

    call('replace_text', { page: 'Log', box: 1, text: 'Replaced.' });
    expect(page('Log').boxes[0].id).not.toBe(log.boxes[0].id);
    expect(call('read_page', { page: 'Log' })[0]).toContain('--- Text box 1 ---\nReplaced.');
  });

  it('updates details and reports mistakes as tool errors', () => {
    call('create_page', { title: 'Aurelane', type: 'place' });
    call('create_page', { title: 'Fort Talbot', type: 'place' });
    expect(call('update_page', { page: 'Fort Talbot', inside_place: 'Aurelane', title: 'Fort Talbot Keep' })[0]).toBe(
      '"Fort Talbot": renamed to "Fort Talbot Keep"; now Place inside Aurelane.',
    );
    expect(call('read_page', { page: 'Fort Talbt' })).toEqual(['No page is called "Fort Talbt". Close names: "Fort Talbot Keep".', true]);
    expect(call('create_page', { title: 'aurelane' })).toEqual(['A page called "aurelane" already exists.', true]);
    expect(call('update_page', { page: 'Aurelane', character_kind: 'pc' })[1]).toBe(true);
  });
});
