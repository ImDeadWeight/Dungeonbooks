/**
 * @file Tool calls in words, for the chat: what the model looked at, and
 * what a change it asks to make would do.
 */
import type { ToolCall } from '../models/types';

const str = (value: unknown) => (typeof value === 'string' ? value : '');

/** One line saying what a call does ("Add text to "Mira Thorne""). */
export function describeCall(call: ToolCall): string {
  const a = call.args ?? {};
  const page = `"${str(a.page)}"`;
  switch (call.name) {
    case 'get_overview':
      return 'Look over the notes';
    case 'search_notes':
      return `Search the notes for "${str(a.query)}"`;
    case 'read_page':
      return `Read ${page}`;
    case 'create_page':
      return `Create the page "${str(a.title)}"${a.folder ? ` in ${str(a.folder)}` : ''}`;
    case 'add_text':
      return `Add text to ${page}`;
    case 'replace_text':
      return `Replace ${a.box ? `text box ${String(a.box)}` : 'the text'} of ${page}`;
    case 'update_page':
      return `Change ${page}`;
    case 'link_mentions':
      return `Link mentions on ${page}`;
    default:
      return call.name;
  }
}

/** The details of a change worth showing before allowing it: the text it writes, and its other settings. */
export function changeDetails(call: ToolCall): { text: string | null; fields: [string, string][] } {
  const a = call.args ?? {};
  const fields = Object.entries(a)
    .filter(([key]) => key !== 'text' && key !== 'page')
    .map(([key, value]): [string, string] => [key.replace(/_/g, ' '), Array.isArray(value) ? value.join(', ') : String(value)]);
  return { text: typeof a.text === 'string' ? a.text : null, fields };
}
