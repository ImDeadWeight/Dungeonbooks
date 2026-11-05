/**
 * @file Encounter links (the chips naming an encounter) inside a notebook's
 * text. A campaign imported as a copy gives its encounters new ids, so the
 * links in its notes are pointed at the new ones.
 */
import type { JSONContent } from '@tiptap/core';
import type { Id } from './ids';
import type { Notebook, Page } from './notebook';

/** The editor's node for an encounter link (see ui/editor). */
const ENCOUNTER_LINK = 'encounterLink';

/** `content` with each encounter link's id passed through `rename`; unchanged parts are kept as they were. */
function renameIn(content: JSONContent, rename: (id: Id) => Id): JSONContent {
  let node = content;
  const id = node.type === ENCOUNTER_LINK ? (node.attrs?.encounterId as Id | undefined) : undefined;
  if (id !== undefined && rename(id) !== id) node = { ...node, attrs: { ...node.attrs, encounterId: rename(id) } };
  if (!node.content) return node;
  const children = node.content.map((child) => renameIn(child, rename));
  return children.some((child, i) => child !== node.content![i]) ? { ...node, content: children } : node;
}

/** The page with its encounter links renamed; the same page when it has none to rename. */
function renamePage(page: Page, rename: (id: Id) => Id): Page {
  const boxes = page.boxes.map((box) => {
    const content = renameIn(box.content, rename);
    return content === box.content ? box : { ...box, content };
  });
  return boxes.some((box, i) => box !== page.boxes[i]) ? { ...page, boxes } : page;
}

/** The notebook with every encounter link's id passed through `rename`. */
export function renameEncounterLinks(notebook: Notebook, rename: (id: Id) => Id): Notebook {
  return { ...notebook, pages: notebook.pages.map((page) => renamePage(page, rename)) };
}
