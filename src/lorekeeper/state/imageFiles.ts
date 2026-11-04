/**
 * @file Storing the open campaign's images and showing them: a picture is
 * shrunk if huge, stored under its content hash, and shown through a cached
 * object URL. Images no page (or anything else that may bring pages back,
 * such as AI undo) uses are deleted when the campaign opens.
 */
import { useEffect, useState } from 'react';
import { useCampaigns } from '../../campaigns/campaignStore';
import { imageExtension, imageIdFor, imageIdsOf, imageMime } from '../domain/images';
import type { Page } from '../domain/notebook';
import { imageStore } from '../storage/images';

/** Longest side kept (px); larger pictures are scaled down, keeping maps sharp enough to zoom. */
const MAX_SIDE = 4096;
/** Files above this are re-encoded even when small enough in pixels. */
const MAX_BYTES = 6 * 1024 * 1024;

const activeCampaign = () => {
  const id = useCampaigns.getState().activeId;
  if (!id) throw new Error('No campaign is open.');
  return id;
};

async function hashHex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The picture as stored: as it is when small enough (and always for GIFs, which may move), else scaled down as WebP. */
async function prepare(file: Blob): Promise<{ bytes: Uint8Array; ext: string }> {
  const ext = imageExtension(file.type);
  if (!ext) throw new Error('That file is not a PNG, JPEG, WebP or GIF image.');
  const original = new Uint8Array(await file.arrayBuffer());
  if (ext === 'gif') return { bytes: original, ext };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && original.byteLength <= MAX_BYTES) return { bytes: original, ext };
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
  if (!blob) throw new Error('Could not shrink that image.');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: 'webp' };
}

/** Stores a picture in the open campaign; resolves to its image id. */
export async function storeImage(file: Blob): Promise<string> {
  const { bytes, ext } = await prepare(file);
  const imageId = imageIdFor(await hashHex(bytes), ext);
  await imageStore(activeCampaign()).put(imageId, bytes);
  return imageId;
}

/** Stores already-prepared bytes (from an import) in a campaign. */
export function putImageBytes(campaignId: string, imageId: string, bytes: Uint8Array): Promise<void> {
  return imageStore(campaignId).put(imageId, bytes);
}

/** An image's bytes in a campaign (for exports), or null when it's missing. */
export function imageBytes(campaignId: string, imageId: string): Promise<Uint8Array | null> {
  return imageStore(campaignId).get(imageId);
}

/** Object URLs by "<campaign>/<image>", made once each. */
const urls = new Map<string, Promise<string | null>>();

function urlFor(campaignId: string, imageId: string): Promise<string | null> {
  const key = `${campaignId}/${imageId}`;
  let url = urls.get(key);
  if (!url) {
    url = imageStore(campaignId)
      .get(imageId)
      .then((bytes) => (bytes ? URL.createObjectURL(new Blob([bytes.slice()], { type: imageMime(imageId) })) : null));
    urls.set(key, url);
  }
  return url;
}

/** The URL to show an open-campaign image with: undefined while loading, null when the file is missing. */
export function useImageUrl(imageId: string): string | null | undefined {
  const campaignId = useCampaigns((s) => s.activeId);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!campaignId) return;
    let live = true;
    setUrl(undefined);
    void urlFor(campaignId, imageId).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [campaignId, imageId]);
  return url;
}

/** Other things that may bring pages (and so their images) back, by campaign. */
const keepers: ((campaignId: string) => Iterable<string>)[] = [];

/** Keeps the images a source names from being cleaned up (AI undo's saved pages). */
export function registerImageKeeper(keeper: (campaignId: string) => Iterable<string>) {
  keepers.push(keeper);
}

/** Deletes the campaign's stored images that nothing uses. */
export async function removeUnusedImages(campaignId: string, pages: Page[]): Promise<void> {
  const used = imageIdsOf(pages);
  for (const keep of keepers) for (const id of keep(campaignId)) used.add(id);
  const store = imageStore(campaignId);
  for (const id of await store.list()) if (!used.has(id)) await store.remove(id);
}

/** Deletes every image of a deleted campaign. */
export function removeCampaignImages(campaignId: string): Promise<void> {
  return imageStore(campaignId).removeAll();
}
