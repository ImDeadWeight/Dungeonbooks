/**
 * @file Getting pictures onto a page: dropped on the canvas (where they
 * land), pasted while the page is open (below everything else), or picked
 * with the page menu's Add image.
 */
import { useEffect, type DragEvent } from 'react';
import type { Id } from '../../domain/ids';
import { belowEverything } from '../../domain/images';
import type { Page } from '../../domain/notebook';
import { addImages } from '../../state/imageActions';
import { useNotebook } from '../../state/notebookStore';

const imagesIn = (files: FileList | null | undefined) => [...(files ?? [])].filter((f) => f.type.startsWith('image/'));

/** Asks for image files and puts them on the page. */
export function pickImages(pageId: Id) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif';
  input.multiple = true;
  input.onchange = () => {
    const page = useNotebook.getState().pages.find((p) => p.id === pageId);
    const files = imagesIn(input.files);
    if (page && files.length) {
      const at = belowEverything(page);
      void addImages(pageId, files, at.x, at.y);
    }
  };
  input.click();
}

/** Drop handlers for the canvas, and pasting images while `page` is open. */
export function useImageInput(page: Page | undefined) {
  useEffect(() => {
    if (!page) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = imagesIn(e.clipboardData?.files);
      if (!files.length) return;
      e.preventDefault();
      const current = useNotebook.getState().pages.find((p) => p.id === page.id);
      if (!current) return;
      const at = belowEverything(current);
      void addImages(page.id, files, at.x, at.y);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [page?.id]);

  return {
    onDragOver(e: DragEvent<HTMLDivElement>) {
      if ([...e.dataTransfer.items].some((i) => i.kind === 'file')) e.preventDefault();
    },
    onDrop(e: DragEvent<HTMLDivElement>) {
      const files = imagesIn(e.dataTransfer.files);
      if (!page || !files.length) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      void addImages(page.id, files, Math.max(0, Math.round(e.clientX - rect.left)), Math.max(0, Math.round(e.clientY - rect.top)));
    },
  };
}
