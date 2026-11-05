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
    case 'add_image':
      return `Add an image to ${page}${a.path ? ` from ${str(a.path)}` : a.url ? ` from ${str(a.url)}` : ''}`;
    case 'draw_image':
      return a.image ? `Redraw image ${String(a.image)} on ${page}` : `Draw an image on ${page}`;
    case 'view_image':
      return `Look at the image on ${page}`;
    case 'add_pin':
      return `Pin "${str(a.pin_page)}" on the map on ${page}`;
    case 'move_pin':
      return `Move pin ${String(a.pin)} on the map on ${page}`;
    case 'remove_pin':
      return `Remove pin ${String(a.pin)} from the map on ${page}`;
    case 'set_caption':
      return `Caption the image on ${page} "${str(a.caption)}"`;
    case 'list_encounters':
      return 'Look over the encounters';
    case 'read_encounter':
      return `Read the encounter "${str(a.encounter)}"`;
    case 'search_creatures':
      return a.query ? `Search creatures for "${str(a.query)}"` : 'Search creatures';
    case 'read_creature':
      return `Read the creature "${str(a.creature)}"`;
    case 'rate_encounter':
      return a.encounter ? `Rate a fight in "${str(a.encounter)}"` : 'Rate a planned fight';
    default:
      return call.name;
  }
}

/** Long values (a picture as base64) shown by their size instead. */
const shorten = (text: string) => (text.length > 300 ? `(${text.length.toLocaleString()} characters)` : text);

/** The details of a change worth showing before allowing it: the text it writes, and its other settings. */
export function changeDetails(call: ToolCall): { text: string | null; fields: [string, string][] } {
  const a = call.args ?? {};
  const fields = Object.entries(a)
    .filter(([key]) => key !== 'text' && key !== 'page')
    .map(([key, value]): [string, string] => [key.replace(/_/g, ' '), shorten(Array.isArray(value) ? value.join(', ') : String(value))]);
  return { text: typeof a.text === 'string' ? a.text : null, fields };
}
