/**
 * @file Which map is open (an image on a page, shown full-panel with its
 * pins), if any.
 */
import { create } from 'zustand';
import type { Id } from '../../domain/ids';

export interface OpenMap {
  pageId: Id;
  boxId: Id;
}

export const useMapView = create<{ open: OpenMap | null }>(() => ({ open: null }));

export const openMap = (map: OpenMap) => useMapView.setState({ open: map });
export const closeMap = () => useMapView.setState({ open: null });
