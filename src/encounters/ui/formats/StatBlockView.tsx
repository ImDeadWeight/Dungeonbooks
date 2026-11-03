/**
 * @file Shows a character's stat block using its format's view component.
 */
import type { CharacterTemplate } from '../../domain/characters';
import { FORMAT_UI } from 'campaign-link/ui/formats/formatUi';

/** Read-only stat block, or nothing when the character has none. */
export function StatBlockView({ template }: { template: CharacterTemplate }) {
  if (!template.statBlock) return null;
  const { View } = FORMAT_UI[template.formatId];
  return <View statBlock={template.statBlock} kind={template.kind} />;
}
