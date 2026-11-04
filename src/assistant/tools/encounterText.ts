/**
 * @file The open campaign's encounters and creatures in words, for AI
 * tools: finding an encounter or creature by name, and describing
 * encounters, combatants, stat blocks and difficulty.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import { FORMAT_LIST, getFormat } from 'campaign-link/formats/registry';
import { useCampaigns } from '../../campaigns/campaignStore';
import type { CharacterTemplate } from '../../encounters/domain/characters';
import type { Combatant } from '../../encounters/domain/combat/types';
import type { Difficulty } from '../../encounters/domain/difficulty/types';
import { rateMembers } from '../../encounters/domain/difficulty/members';
import { flattenAreas } from '../../encounters/domain/library/tree';
import type { Encounter } from '../../encounters/domain/library/types';
import { useCharacters } from '../../encounters/state/characterStore';
import { useLibrary } from '../../encounters/state/libraryStore';
import { ToolError } from './types';

/** The open campaign (tools work on it). */
export function openCampaign() {
  const { campaigns, activeId } = useCampaigns.getState();
  const campaign = campaigns.find((c) => c.id === activeId);
  if (!campaign) throw new ToolError('No campaign is open in Dungeon Books.');
  return campaign;
}

/** The open campaign's encounters. */
export const campaignEncounters = (): Encounter[] => useLibrary.getState().encounters.filter((e) => e.campaignId === openCampaign().id);

/** "Prison › Mines" for an encounter's area, or '' when it sits directly under the campaign. */
export function areaPathOf(encounter: Encounter): string {
  if (!encounter.areaId) return '';
  return flattenAreas(useLibrary.getState(), encounter.campaignId).find((a) => a.area.id === encounter.areaId)?.path ?? '';
}

/** The encounter a name (any case) or id picks; close names on a miss. */
export function findEncounter(name: unknown): Encounter {
  if (typeof name !== 'string' || !name.trim()) throw new ToolError('Name the encounter (list_encounters shows them).');
  const all = campaignEncounters();
  const key = name.trim().toLowerCase();
  const exact = all.find((e) => e.id === name || e.name.toLowerCase() === key);
  if (exact) return exact;
  // A part of one name is enough when only one encounter has it.
  const partial = all.filter((e) => e.name.toLowerCase().includes(key));
  if (partial.length === 1) return partial[0];
  const close = partial.map((e) => `"${e.name}"`);
  throw new ToolError(`No encounter is called "${name}".${close.length ? ` Close names: ${close.join(', ')}.` : ' list_encounters shows them all.'}`);
}

const template = (id: string): CharacterTemplate | undefined => useCharacters.getState().templates.find((t) => t.id === id);

/** How hard an encounter is, as the app rates it (null when its format has no rating or it has no foes). */
export function encounterDifficulty(encounter: Encounter): Difficulty | null {
  const members = encounter.combatants.flatMap((c) => {
    const t = template(c.templateId);
    return t ? [{ template: t, side: c.side }] : [];
  });
  return rateMembers(encounter.formatId, members, openCampaign().party);
}

/** "Moderate (250 XP; Low up to 200, Moderate up to 300, High up to 400)", with any caveats. */
export function difficultyText(d: Difficulty): string {
  const scale = d.thresholds.map((t) => `${t.name} up to ${t.xp.toLocaleString()}`).join(', ');
  return [`${d.rating} (${d.xp.toLocaleString()} XP; ${scale}). Rules: ${d.source}.`, ...d.notes].join(' ');
}

/** One line about an encounter for the list. */
export function encounterLine(e: Encounter): string {
  const combat = e.combat.active ? `in combat, round ${e.combat.round}` : 'not in combat';
  const difficulty = encounterDifficulty(e);
  return `- ${e.name} (${getFormat(e.formatId).name}; ${e.combatants.length} in it; ${combat}${difficulty ? `; ${difficulty.rating}` : ''})`;
}

/** One combatant: name, PC/NPC, HP, initiative, side, state, conditions, and whose turn it is. */
export function combatantLine(c: Combatant, current: boolean): string {
  const t = template(c.templateId);
  const parts = [t?.kind === 'pc' ? 'PC' : 'NPC'];
  if (c.maxHp !== null && c.currentHp !== null) parts.push(`HP ${c.currentHp}/${c.maxHp}${c.tempHp ? ` +${c.tempHp} temp` : ''}`);
  if (c.initiative !== null) parts.push(`initiative ${c.initiative}`);
  if (c.side.trim()) parts.push(`side ${c.side.trim()}`);
  if (c.status !== 'active') parts.push(c.status);
  if (c.conditions.length) parts.push(`conditions: ${c.conditions.map((x) => (x.value !== null ? `${x.name} ${x.value}` : x.name)).join(', ')}`);
  if (c.tokenDescription.trim()) parts.push(`token: ${c.tokenDescription.trim()}`);
  return `- ${current ? '▶ ' : ''}${c.name} (${parts.join('; ')})`;
}

/** The format a tool argument names, else the campaign's default, else 5e (2014). */
export function formatArg(value: unknown, allowed?: FormatId[]): FormatId {
  const fallback = openCampaign().formatId ?? 'dnd5e';
  const id = (value ?? fallback) as FormatId;
  const ids = allowed ?? FORMAT_LIST.map((f) => f.id);
  if (!ids.includes(id)) throw new ToolError(`format must be one of ${ids.join(', ')}.`);
  return id;
}
