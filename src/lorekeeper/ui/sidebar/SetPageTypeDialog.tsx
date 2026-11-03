/**
 * @file Sets the type of every page in a folder at once (optionally its
 * sub-folders too), e.g. making a whole "Characters" folder into NPCs.
 */
import { useState } from 'react';
import { descendantFolderIds, infoForType, PAGE_TYPES, type CharacterKind, type PageType } from '../../domain/notebook';
import { useNotebook } from '../../state/notebookStore';
import { useUi } from '../../state/uiStore';
import { Modal } from '../common/Modal';

/** Shown while the UI store names a folder to set page types in. */
export function SetPageTypeDialog() {
  const folderId = useUi((s) => s.pageTypeFolderId);
  const folder = useNotebook((s) => s.folders.find((f) => f.id === folderId));
  const close = () => useUi.getState().setPageTypeFolder(null);
  if (!folder) return null;
  // Keyed by folder so the choices reset each time it opens.
  return <Dialog key={folder.id} folderId={folder.id} folderName={folder.name} close={close} />;
}

function Dialog({ folderId, folderName, close }: { folderId: string; folderName: string; close: () => void }) {
  const [type, setType] = useState<PageType>('character');
  const [kind, setKind] = useState<CharacterKind>('npc');
  const [nested, setNested] = useState(true);
  const { folders, pages } = useNotebook.getState();

  const inside = new Set([folderId, ...(nested ? descendantFolderIds(folders, folderId) : [])]);
  const ids = pages.filter((p) => p.folderId && inside.has(p.folderId)).map((p) => p.id);

  const apply = () => {
    useNotebook
      .getState()
      .setPageInfo(ids, (current) => (type === 'character' ? { type, kind } : infoForType(type, current)));
    close();
  };

  return (
    <Modal
      title="Set page type"
      size="small"
      onClose={close}
      footer={
        <>
          <button onClick={close}>Cancel</button>
          <button className="primary" disabled={ids.length === 0} onClick={apply}>
            Set {ids.length} page{ids.length === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <div className="set-type-form">
        <p>
          Every page in <strong>{folderName}</strong> becomes:
        </p>
        <div className="row">
          <select value={type} onChange={(e) => setType(e.target.value as PageType)}>
            {PAGE_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
          {type === 'character' && (
            <select value={kind} onChange={(e) => setKind(e.target.value as CharacterKind)}>
              <option value="npc">NPC</option>
              <option value="pc">Player character</option>
            </select>
          )}
        </div>
        <label className="inline">
          <input type="checkbox" checked={nested} onChange={(e) => setNested(e.target.checked)} />
          Include pages in sub-folders
        </label>
        {type === 'place' && <p className="muted">Places that are already places keep the place they're inside.</p>}
      </div>
    </Modal>
  );
}
