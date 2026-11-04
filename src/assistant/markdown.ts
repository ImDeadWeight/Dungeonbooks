/**
 * @file Page text as Markdown, for AI apps and the copy buttons. Text boxes
 * hold TipTap documents; this turns them into Markdown and back. Links to
 * pages are written [[Title]], or [[Title|the words shown]] when the words
 * differ from the title. Encounter chips come out as [encounter: Name] and
 * are not read back. Covers what the editor offers: headings, paragraphs,
 * bold, italic, strikethrough, code, lists, quotes, rules and line breaks.
 */
import type { JSONContent } from '@tiptap/core';

/** Looks up pages for links. */
export interface LinkNames {
  /** A page's title by id; undefined for a deleted page (its links come out as plain words). */
  titleOf(pageId: string): string | undefined;
  /** The page a [[name]] means (a title or alias, any case); undefined when there is none. */
  pageNamed(name: string): string | undefined;
}

// ---- To Markdown ------------------------------------------------------------

const MARK_SYNTAX: Record<string, string> = { bold: '**', italic: '*', strike: '~~', code: '`' };

/** Inline content (text, marks, links, chips, line breaks) as Markdown. */
function inlineMarkdown(nodes: JSONContent[] = [], names: LinkNames): string {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      out += '\\\n';
    } else if (node.type === 'encounterLink') {
      out += `[encounter: ${node.attrs?.name ?? 'Encounter'}]`;
    } else if (node.type === 'text' && node.text) {
      let text = node.text;
      const marks = node.marks ?? [];
      for (const mark of marks) {
        const syntax = MARK_SYNTAX[mark.type];
        if (syntax) text = `${syntax}${text}${syntax}`;
      }
      const link = marks.find((m) => m.type === 'pageLink');
      const title = link && names.titleOf(link.attrs?.pageId);
      if (title) text = node.text.trim().toLowerCase() === title.trim().toLowerCase() ? `[[${title}]]` : `[[${title}|${text}]]`;
      out += text;
    }
  }
  return out;
}

/** A block and everything in it as Markdown lines, each prefixed by `indent`. */
function blockMarkdown(node: JSONContent, names: LinkNames, indent = ''): string[] {
  const children = node.content ?? [];
  switch (node.type) {
    case 'heading':
      return [`${indent}${'#'.repeat(node.attrs?.level ?? 1)} ${inlineMarkdown(children, names)}`];
    case 'paragraph':
      return [indent + inlineMarkdown(children, names).replace(/\n/g, `\n${indent}`)];
    case 'bulletList':
    case 'orderedList':
      return children.flatMap((item, i) => {
        const bullet = node.type === 'bulletList' ? '- ' : `${(node.attrs?.start ?? 1) + i}. `;
        const [first = '', ...rest] = (item.content ?? []).flatMap((child) => blockMarkdown(child, names, indent + '  '));
        return [indent + bullet + first.slice(indent.length + 2), ...rest];
      });
    case 'blockquote':
      return children.flatMap((child) => blockMarkdown(child, names)).map((line) => `${indent}> ${line}`);
    case 'codeBlock':
      return [`${indent}\`\`\``, ...inlineMarkdown(children, names).split('\n').map((l) => indent + l), `${indent}\`\`\``];
    case 'horizontalRule':
      return [`${indent}---`];
    default:
      return children.flatMap((child) => blockMarkdown(child, names, indent));
  }
}

/** A text box's document as Markdown, blocks separated by blank lines. */
export function toMarkdown(doc: JSONContent, names: LinkNames): string {
  return (doc.content ?? [])
    .map((block) => blockMarkdown(block, names).join('\n'))
    .filter((text) => text.trim())
    .join('\n\n');
}

// ---- From Markdown ----------------------------------------------------------

/** What reading Markdown found besides the document: [[names]] that match no page. */
export interface ParseResult {
  doc: JSONContent;
  unknownLinks: string[];
}

type Mark = NonNullable<JSONContent['marks']>[number];

const INLINE =
  /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]|\*\*(.+?)\*\*|~~(.+?)~~|`([^`]+)`|(?<![\p{L}\p{N}*])\*(?!\s)(.+?)(?<!\s)\*(?!\*)|(?<![\p{L}\p{N}_])_(?!\s)(.+?)(?<!\s)_(?![\p{L}\p{N}_])/gu;

/** Inline Markdown as text nodes with marks and links. */
function parseInline(text: string, names: LinkNames, unknown: Set<string>, marks: Mark[] = []): JSONContent[] {
  const nodes: JSONContent[] = [];
  const push = (t: string, m: Mark[]) => {
    if (!t) return;
    // Backslash at the end of a line is a line break.
    t.split(/\\\n|\n/).forEach((part, i) => {
      if (i > 0) nodes.push({ type: 'hardBreak' });
      if (part) nodes.push(m.length ? { type: 'text', text: part, marks: m } : { type: 'text', text: part });
    });
  };
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    push(text.slice(last, m.index), marks);
    last = m.index! + m[0].length;
    const [, linkName, linkText, bold, strike, code, star, underscore] = m;
    if (linkName !== undefined) {
      const pageId = names.pageNamed(linkName.trim());
      if (pageId) push(linkText ?? linkName, [...marks, { type: 'pageLink', attrs: { pageId } }]);
      else {
        unknown.add(linkName.trim());
        push(linkText ?? linkName, marks);
      }
    } else if (code !== undefined) {
      push(code, [...marks, { type: 'code' }]);
    } else {
      const [inner, type] = bold !== undefined ? [bold, 'bold'] : strike !== undefined ? [strike, 'strike'] : [star ?? underscore, 'italic'];
      nodes.push(...parseInline(inner, names, unknown, [...marks, { type }]));
    }
  }
  push(text.slice(last), marks);
  return nodes;
}

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

/** Builds blocks from lines; lists nest by indentation. */
function parseBlocks(lines: string[], names: LinkNames, unknown: Set<string>): JSONContent[] {
  const blocks: JSONContent[] = [];
  const paragraph = (text: string): JSONContent => {
    const content = parseInline(text, names, unknown);
    return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (heading) {
      blocks.push({ type: 'heading', attrs: { level: heading[1].length }, content: parseInline(heading[2], names, unknown) });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: 'horizontalRule' });
      i++;
      continue;
    }
    if (line.trim().startsWith('```')) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith('```'); i++) code.push(lines[i]);
      i++;
      blocks.push(code.length ? { type: 'codeBlock', content: [{ type: 'text', text: code.join('\n') }] } : { type: 'codeBlock' });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) quoted.push(lines[i].replace(/^\s*>\s?/, ''));
      blocks.push({ type: 'blockquote', content: parseBlocks(quoted, names, unknown) });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      const indent = item[1].length;
      const ordered = /\d/.test(item[2]);
      const items: JSONContent[] = [];
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i]);
        if (!m || m[1].length !== indent || /\d/.test(m[2]) !== ordered) break;
        // The item's own text, then anything indented under it (a nested list, more lines).
        const inner = [m[3]];
        for (i++; i < lines.length && lines[i].trim() && (lines[i].length - lines[i].trimStart().length) > indent; i++) {
          inner.push(lines[i].slice(Math.min(indent + 2, lines[i].length - lines[i].trimStart().length)));
        }
        items.push({ type: 'listItem', content: parseBlocks(inner, names, unknown) });
      }
      const start = ordered ? parseInt(item[2], 10) : 1;
      blocks.push(ordered ? { type: 'orderedList', attrs: { start }, content: items } : { type: 'bulletList', content: items });
      continue;
    }
    // A paragraph: lines up to a blank line or the start of another kind of block.
    const text: string[] = [];
    for (; i < lines.length && lines[i].trim() && !/^\s*(#{1,6}\s|>|```)/.test(lines[i]) && !LIST_ITEM.test(lines[i]); i++) text.push(lines[i].trim());
    blocks.push(paragraph(text.join('\n')));
  }
  return blocks;
}

/** Markdown as a text box document, linking [[names]] that match pages. */
export function fromMarkdown(markdown: string, names: LinkNames): ParseResult {
  const unknown = new Set<string>();
  const content = parseBlocks(markdown.replace(/\r\n?/g, '\n').split('\n'), names, unknown);
  return { doc: { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }, unknownLinks: [...unknown] };
}
