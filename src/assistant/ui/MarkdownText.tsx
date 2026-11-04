/**
 * @file A model's Markdown shown formatted: headings, bold, italic, lists,
 * quotes, code and rules, read with the same parser the notes tools use.
 * [[Page]] links that match a page open it in the notes.
 */
import type { JSONContent } from '@tiptap/core';
import { useMemo, type ReactNode } from 'react';
import { openTarget } from '../../bridge/navigation';
import { fromMarkdown } from '../markdown';
import { linkNames } from '../notesMarkdown';

/** A text node with its marks, innermost first. */
function textNode(node: JSONContent, campaignId: string, key: number): ReactNode {
  let out: ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') out = <strong>{out}</strong>;
    else if (mark.type === 'italic') out = <em>{out}</em>;
    else if (mark.type === 'strike') out = <s>{out}</s>;
    else if (mark.type === 'code') out = <code>{out}</code>;
    else if (mark.type === 'pageLink') {
      const pageId = mark.attrs?.pageId;
      out = (
        <button className="assistant-page-link" onClick={() => openTarget({ app: 'lorekeeper', kind: 'page', notebookId: campaignId, pageId })}>
          {out}
        </button>
      );
    }
  }
  return <span key={key}>{out}</span>;
}

/** A block and what is in it. */
function block(node: JSONContent, campaignId: string, key: number): ReactNode {
  const children = (node.content ?? []).map((child, i) => block(child, campaignId, i));
  switch (node.type) {
    case 'text':
      return textNode(node, campaignId, key);
    case 'hardBreak':
      return <br key={key} />;
    case 'paragraph':
      return <p key={key}>{children}</p>;
    case 'heading': {
      const Tag = `h${Math.min(Math.max(node.attrs?.level ?? 1, 1), 6)}` as 'h1';
      return <Tag key={key}>{children}</Tag>;
    }
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={node.attrs?.start ?? 1}>
          {children}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{node.content?.[0]?.text}</code>
        </pre>
      );
    case 'horizontalRule':
      return <hr key={key} />;
    default:
      return children;
  }
}

/** Markdown text, formatted; links resolve against the open campaign's pages. */
export function MarkdownText({ text, campaignId }: { text: string; campaignId: string }) {
  const doc = useMemo(() => fromMarkdown(text, linkNames()).doc, [text]);
  return <div className="assistant-text">{(doc.content ?? []).map((node, i) => block(node, campaignId, i))}</div>;
}
