/**
 * @file The icon shown for each page type (sidebar rows, the type picker).
 */
import { FileText, Flag, Gem, MapPin, User, type LucideIcon } from 'lucide-react';
import type { PageType } from '../../domain/notebook';

/** Icon per page type. */
const ICONS: Record<PageType, LucideIcon> = {
  note: FileText,
  character: User,
  place: MapPin,
  faction: Flag,
  item: Gem,
};

/** The icon for a page type. */
export function PageTypeIcon({ type, size = 15 }: { type: PageType; size?: number }) {
  const Icon = ICONS[type];
  return <Icon size={size} />;
}
