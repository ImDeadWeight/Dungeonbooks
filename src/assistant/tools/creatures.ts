/**
 * @file Creatures for AI tools: the user's characters and the SRD
 * compendium's creatures of a format, found by name, with their stat blocks
 * in words.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import { ABILITIES, abilityModifier } from 'campaign-link/formats/dnd5e/abilities';
import type { Dnd5eStatBlock } from 'campaign-link/formats/dnd5e/statBlock';
import { formatFormula, formatModifier } from 'campaign-link/formats/dice';
import type { CharacterTemplate, StatBlock } from '../../encounters/domain/characters';
import type { Foe } from '../../encounters/domain/difficulty/types';
import { foeOf } from '../../encounters/domain/difficulty';
import { hasCompendium, type CompendiumEntry } from '../../encounters/domain/compendium/types';
import { useCharacters } from '../../encounters/state/characterStore';
import { loadCompendium } from '../../encounters/state/compendium';
import { ToolError } from './types';

/** A creature from either source. */
export interface Creature {
  name: string;
  source: 'library' | 'SRD';
  /** "CR 1/4", "level 3", or '' when it has no stat block. */
  rank: string;
  type: string;
  statBlock: StatBlock | null;
  /** How difficulty counts it; null without a stat block. */
  foe: Foe | null;
  kind: 'pc' | 'npc';
}

const is5e = (formatId: FormatId) => formatId === 'dnd5e' || formatId === 'dnd5e2024';

function fromTemplate(t: CharacterTemplate): Creature {
  const foe = foeOf(t);
  const sb = t.statBlock as { creatureType?: string } | null;
  return {
    name: t.name,
    source: 'library',
    rank: !foe ? '' : 'cr' in foe ? `CR ${foe.cr}` : `level ${foe.level}`,
    type: sb?.creatureType ?? '',
    statBlock: t.statBlock,
    foe,
    kind: t.kind,
  };
}

const fromEntry = (e: CompendiumEntry): Creature => ({ name: e.name, source: 'SRD', rank: `CR ${e.cr}`, type: e.type, statBlock: e.statBlock, foe: { cr: e.cr }, kind: 'npc' });

/** The user's characters of a format, then the format's SRD creatures (when it has some). */
export async function creaturesOf(formatId: FormatId): Promise<Creature[]> {
  const mine = useCharacters.getState().templates.filter((t) => t.formatId === formatId && !t.compendiumId).map(fromTemplate);
  const srd = hasCompendium(formatId) ? (await loadCompendium(formatId)).entries.map(fromEntry) : [];
  return [...mine, ...srd];
}

/** The creature a name picks (any case; the user's own first); close names on a miss. */
export async function findCreature(name: unknown, formatId: FormatId): Promise<Creature> {
  if (typeof name !== 'string' || !name.trim()) throw new ToolError('Name the creature.');
  const all = await creaturesOf(formatId);
  const key = name.trim().toLowerCase();
  const found = all.find((c) => c.name.toLowerCase() === key);
  if (found) return found;
  const close = all.filter((c) => c.name.toLowerCase().includes(key)).slice(0, 8);
  throw new ToolError(`No creature called "${name}" in your characters${hasCompendium(formatId) ? ' or the SRD' : ''}.${close.length ? ` Close names: ${close.map((c) => `"${c.name}"`).join(', ')}.` : ' search_creatures finds them.'}`);
}

/** One line for a search result. */
export function creatureLine(c: Creature): string {
  const sb = c.statBlock as Partial<Dnd5eStatBlock> | null;
  const stats = sb && typeof sb.armorClass === 'number' ? `; AC ${sb.armorClass}, HP ${sb.maxHp}` : '';
  return `- ${c.name} (${[c.source === 'library' ? `yours, ${c.kind.toUpperCase()}` : 'SRD', c.rank, c.type].filter(Boolean).join(', ')}${stats})`;
}

/** A 5e stat block as the book prints it. */
function dnd5eText(sb: Dnd5eStatBlock): string {
  const lines = [
    `${sb.size} ${sb.creatureType}, ${sb.alignment}`,
    `Armor Class ${sb.armorClass}${sb.armorNote ? ` (${sb.armorNote})` : ''}`,
    `Hit Points ${sb.maxHp}${sb.hitDice ? ` (${formatFormula(sb.hitDice)})` : ''}`,
    `Speed ${sb.speed}`,
    ABILITIES.map((a) => `${a.toUpperCase()} ${sb.abilities[a]} (${formatModifier(abilityModifier(sb.abilities[a]))})`).join(', '),
  ];
  const optional: [string, string][] = [
    ['Damage Vulnerabilities', sb.damageVulnerabilities],
    ['Damage Resistances', sb.damageResistances],
    ['Damage Immunities', sb.damageImmunities],
    ['Condition Immunities', sb.conditionImmunities],
    ['Senses', sb.senses],
    ['Languages', sb.languages],
  ];
  for (const [label, value] of optional) if (value) lines.push(`${label} ${value}`);
  lines.push(`Challenge ${sb.challengeRating}`);
  const sections: [string, Dnd5eStatBlock['traits']][] = [
    ['Traits', sb.traits],
    ['Actions', sb.actions],
    ['Bonus Actions', sb.bonusActions],
    ['Reactions', sb.reactions],
    ['Legendary Actions', sb.legendaryActions],
  ];
  for (const [title, entries] of sections) {
    if (entries.length) lines.push('', `${title}:`, ...entries.map((e) => `${e.name}. ${e.description}`));
  }
  return lines.join('\n');
}

/** A creature's stat block in words (5e as printed; other systems as their fields). */
export function statBlockText(c: Creature, formatId: FormatId): string {
  if (!c.statBlock) return `${c.name} has no stat block.`;
  return is5e(formatId) ? dnd5eText(c.statBlock as Dnd5eStatBlock) : JSON.stringify(c.statBlock, null, 1);
}
