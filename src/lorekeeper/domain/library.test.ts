import { describe, expect, it } from 'vitest';
import { exportFileName, exportText, parseNotebookFile, uniqueName } from './library';
import { createEmptyStatBlock } from 'campaign-link/formats/dnd5e/statBlock';
import type { Notebook } from './notebook';

const notebook: Notebook = {
  folders: [{ id: 'f1', name: 'Factions', parentId: null }],
  pages: [
    {
      id: 'p1',
      title: 'The Thalamar Imperium',
      folderId: 'f1',
      boxes: [{ id: 'b1', x: 40, y: 40, width: 560, content: { type: 'doc', content: [{ type: 'paragraph' }] } }],
    },
  ],
};

describe('unique notebook names', () => {
  it('keeps a free name', () => {
    expect(uniqueName(['Veilstrand'], 'New notebook')).toBe('New notebook');
  });

  it('numbers a taken name, ignoring case', () => {
    expect(uniqueName(['new notebook', 'New notebook (2)'], 'New notebook')).toBe('New notebook (3)');
  });
});

describe('export file names', () => {
  it('drops characters Windows forbids', () => {
    expect(exportFileName('Veil: "Storm"?')).toBe('Veil Storm.json');
  });

  it('never ends up empty', () => {
    expect(exportFileName('???')).toBe('notebook.json');
  });
});

describe('reading notebook files', () => {
  it('round-trips an export', () => {
    expect(parseNotebookFile(exportText('The Veilstrand and the Everstorm', notebook), 'file')).toEqual({
      name: 'The Veilstrand and the Everstorm',
      notebook,
    });
  });

  it('accepts a saved notebook file, named after the file', () => {
    const saved = JSON.stringify({ version: 1, data: notebook });
    expect(parseNotebookFile(saved, 'notebook')).toEqual({ name: 'notebook', notebook });
  });

  it('refuses files that are not notebooks', () => {
    expect(() => parseNotebookFile('not json', 'x')).toThrow('not valid JSON');
    expect(() => parseNotebookFile('{"hello": 1}', 'x')).toThrow('not a Lorekeeper notebook');
    expect(() => parseNotebookFile('{"format": "lorekeeper-notebook", "version": 99}', 'x')).toThrow('newer version');
  });

  it('refuses damaged pages', () => {
    const bad = { ...notebook, pages: [{ title: 'No id' }] };
    expect(() => parseNotebookFile(exportText('x', bad as unknown as Notebook), 'x')).toThrow('page 1 is damaged');
  });

  it('moves things in missing folders, and folder loops, to the top level', () => {
    const tangled: Notebook = {
      folders: [
        { id: 'a', name: 'A', parentId: 'b' },
        { id: 'b', name: 'B', parentId: 'a' },
      ],
      pages: [{ id: 'p', title: 'Lost', folderId: 'gone', boxes: [] }],
    };
    const { notebook: read } = parseNotebookFile(exportText('x', tangled), 'x');
    expect(read.pages[0].folderId).toBeNull();
    expect(read.folders.some((f) => f.parentId === null)).toBe(true);
  });
});

describe('reading page types', () => {
  it('keeps valid info, drops unknown types, and repairs place parents', () => {
    const typed = {
      folders: [],
      pages: [
        { id: 'a', title: 'A', folderId: null, boxes: [], info: { type: 'place', parentPlaceId: 'b' } },
        { id: 'b', title: 'B', folderId: null, boxes: [], info: { type: 'place', parentPlaceId: 'a' } },
        { id: 'c', title: 'C', folderId: null, boxes: [], info: { type: 'place', parentPlaceId: 'gone' } },
        { id: 'd', title: 'D', folderId: null, boxes: [], info: { type: 'character', kind: 'pc' } },
        { id: 'e', title: 'E', folderId: null, boxes: [], info: { type: 'spaceship' } },
      ],
    };
    const { notebook: read } = parseNotebookFile(exportText('x', typed as unknown as Notebook), 'x');
    const info = Object.fromEntries(read.pages.map((p) => [p.id, p.info]));
    expect([info.a, info.b].filter((i) => i?.type === 'place' && i.parentPlaceId === null)).toHaveLength(1);
    expect(info.c).toEqual({ type: 'place', parentPlaceId: null });
    expect(info.d).toEqual({ type: 'character', kind: 'pc' });
    expect(info.e).toBeUndefined();
  });
});

describe('reading stat blocks', () => {
  const statBlock = { formatId: 'dnd5e', statBlock: { ...createEmptyStatBlock(), armorClass: 15 } } as const;
  const page = (extra: object) => ({ id: 'mira', title: 'Mira', folderId: null, boxes: [], info: { type: 'character', kind: 'npc' }, ...extra });
  const read = (p: object) => parseNotebookFile(JSON.stringify({ data: { folders: [], pages: [p] } }), 'Notes').notebook.pages[0];

  it('keeps a character stat block through export and import', () => {
    const notebook: Notebook = { folders: [], pages: [page({ statBlock }) as Notebook['pages'][number]] };
    expect(parseNotebookFile(exportText('Notes', notebook), 'x').notebook.pages[0].statBlock).toEqual(statBlock);
  });

  it('drops a damaged or unknown-system stat block but keeps the page', () => {
    expect(read(page({ statBlock: { formatId: 'gurps', statBlock: {} } }))).not.toHaveProperty('statBlock');
    expect(read(page({ statBlock: { formatId: 'dnd5e', statBlock: 7 } })).title).toBe('Mira');
  });
});
