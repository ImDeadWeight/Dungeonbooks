/**
 * @file What AI apps can see of the open campaign's Encounters tab, without
 * changing anything: its encounters (by area), one encounter's combatants and
 * difficulty, the creatures to build fights from (the user's characters and
 * the SRD), and how hard a planned fight would be.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import { getFormat } from 'campaign-link/formats/registry';
import { characterLevel, raterFor } from '../../encounters/domain/difficulty';
import type { Foe } from '../../encounters/domain/difficulty/types';
import { flattenAreas, looseEncountersOf } from '../../encounters/domain/library/tree';
import { useCharacters } from '../../encounters/state/characterStore';
import { useLibrary } from '../../encounters/state/libraryStore';
import { creatureLine, creaturesOf, findCreature, statBlockText } from './creatures';
import {
  areaPathOf,
  campaignEncounters,
  combatantLine,
  difficultyText,
  encounterDifficulty,
  encounterLine,
  findEncounter,
  formatArg,
  openCampaign,
} from './encounterText';
import { ToolError, type Tool } from './types';

/** Most search results listed. */
const SEARCH_LIMIT = 25;

const ENCOUNTER_ARG = { type: 'string', description: 'The encounter: its name (or a unique part of it) or id.' };
const FORMAT_ARG = { type: 'string', description: 'Game system id (dnd5e, dnd5e2024, pf2e, sf2e, pf1e, dnd35, bx); the campaign’s default when left out.' };

/** A CR ("1/4") or level as a number, for range filters. */
const rankValue = (rank: string) => {
  const [top, bottom] = rank.replace(/^(CR|level) /, '').split('/').map(Number);
  return bottom ? top / bottom : top;
};

/** The party for rate_encounter: given levels, the encounter's PCs, or the campaign's usual party. */
function partyArg(value: unknown, encounterPcs: number[]): { levels: number[]; note: string } {
  if (Array.isArray(value) && value.length) {
    if (!value.every((l) => typeof l === 'number' && Number.isFinite(l))) throw new ToolError('party_levels must be a list of numbers.');
    return { levels: value as number[], note: '' };
  }
  if (encounterPcs.length) return { levels: encounterPcs, note: 'Party: the encounter’s PCs.' };
  const party = openCampaign().party;
  if (party) return { levels: Array.from({ length: party.size }, () => party.level), note: `Party: the campaign’s usual party of ${party.size} at level ${party.level}.` };
  throw new ToolError('Say the party with party_levels (one level per character); the campaign has no usual party set.');
}

export const ENCOUNTER_TOOLS: Tool[] = [
  {
    name: 'list_encounters',
    title: 'List encounters',
    description: "The open campaign's encounters, grouped by area, each with its game system, how many are in it, whether it's in combat, and how hard it is.",
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    run() {
      const campaign = openCampaign();
      const lib = useLibrary.getState();
      const all = campaignEncounters();
      if (!all.length) return `"${campaign.name}" has no encounters yet.`;
      const lines = [`Encounters in "${campaign.name}":`];
      const loose = looseEncountersOf(lib, campaign.id);
      if (loose.length) lines.push(...loose.map(encounterLine));
      for (const { area, path } of flattenAreas(lib, campaign.id)) {
        const inArea = all.filter((e) => e.areaId === area.id);
        if (inArea.length) lines.push('', `${path}:`, ...inArea.map(encounterLine));
      }
      return lines.join('\n');
    },
  },
  {
    name: 'read_encounter',
    title: 'Read an encounter',
    description: 'One encounter: its area, game system, combat state (round, whose turn: ▶), each combatant (PC or NPC, HP, initiative, side, dying or dead, conditions), and its difficulty with the thresholds.',
    inputSchema: { type: 'object', properties: { encounter: ENCOUNTER_ARG }, required: ['encounter'] },
    readOnly: true,
    run({ encounter: name }) {
      const e = findEncounter(name);
      const area = areaPathOf(e);
      const lines = [`# ${e.name}`, `Game system: ${getFormat(e.formatId).name}${area ? `; area: ${area}` : ''}`];
      lines.push(e.combat.active ? `In combat, round ${e.combat.round}.` : 'Not in combat.');
      lines.push('', e.combatants.length ? 'Combatants:' : 'Nobody is in it yet.');
      lines.push(...e.combatants.map((c) => combatantLine(c, c.id === e.combat.currentId)));
      const difficulty = encounterDifficulty(e);
      if (difficulty) lines.push('', `Difficulty: ${difficultyText(difficulty)}`);
      return lines.join('\n');
    },
  },
  {
    name: 'search_creatures',
    title: 'Search creatures',
    description:
      "Finds creatures to build a fight from: the user's own NPCs of a game system, then (for 5e) the SRD's creatures. Filter by name, CR or level range, and type. Lists name, source, CR or level, type, AC and HP.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Part of the name; leave out to list by the other filters.' },
        format: FORMAT_ARG,
        min_cr: { type: 'string', description: 'Lowest CR (5e, "1/4") or level (PF2e) to list.' },
        max_cr: { type: 'string', description: 'Highest CR or level to list.' },
        type: { type: 'string', description: 'Creature type, e.g. "undead".' },
      },
    },
    readOnly: true,
    async run({ query, format, min_cr, max_cr, type }) {
      const formatId = formatArg(format);
      const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
      const min = typeof min_cr === 'string' && min_cr ? rankValue(min_cr) : null;
      const max = typeof max_cr === 'string' && max_cr ? rankValue(max_cr) : null;
      const t = typeof type === 'string' ? type.trim().toLowerCase() : '';
      const found = (await creaturesOf(formatId)).filter(
        (c) =>
          c.kind === 'npc' &&
          (!q || c.name.toLowerCase().includes(q)) &&
          (!t || c.type.toLowerCase().includes(t)) &&
          (min === null || (c.rank && rankValue(c.rank) >= min)) &&
          (max === null || (c.rank && rankValue(c.rank) <= max)),
      );
      if (!found.length) return `No ${getFormat(formatId).name} creatures match.`;
      const more = found.length > SEARCH_LIMIT ? `\n…and ${found.length - SEARCH_LIMIT} more; narrow the search.` : '';
      return `${getFormat(formatId).name} creatures:\n${found.slice(0, SEARCH_LIMIT).map(creatureLine).join('\n')}${more}`;
    },
  },
  {
    name: 'read_creature',
    title: 'Read a creature',
    description: "A creature's full stat block (one of the user's characters, or an SRD creature): defences, abilities, traits, actions and so on.",
    inputSchema: { type: 'object', properties: { creature: { type: 'string', description: 'Its exact name (search_creatures finds names).' }, format: FORMAT_ARG }, required: ['creature'] },
    readOnly: true,
    async run({ creature, format }) {
      const formatId = formatArg(format);
      const c = await findCreature(creature, formatId);
      return `# ${c.name} (${c.source === 'SRD' ? 'SRD' : 'your character'})\n${statBlockText(c, formatId)}`;
    },
  },
  {
    name: 'rate_encounter',
    title: 'Rate a planned fight',
    description:
      "How hard a fight would be, by the game system's encounter rules (5e, PF2e and SF2e): give the foes (by creature name, or by CR or level) and how many of each. The party is party_levels, else the PCs of `encounter`, else the campaign's usual party. With `encounter`, its current NPC foes count too, so you can see what adding more would do.",
    inputSchema: {
      type: 'object',
      properties: {
        foes: {
          type: 'array',
          description: 'Foes to add, each { creature, count } or { cr, count } (5e) or { level, count } (PF2e).',
          items: {
            type: 'object',
            properties: { creature: { type: 'string' }, cr: { type: 'string' }, level: { type: 'number' }, count: { type: 'integer', minimum: 1 } },
          },
        },
        party_levels: { type: 'array', items: { type: 'number' }, description: 'One level per character, e.g. [3, 3, 4, 3].' },
        encounter: ENCOUNTER_ARG,
        format: FORMAT_ARG,
      },
    },
    readOnly: true,
    async run({ foes, party_levels, encounter: name, format }) {
      const existing = name === undefined ? null : findEncounter(name);
      const formatId: FormatId = existing?.formatId ?? formatArg(format);
      const rater = raterFor(formatId);
      if (!rater) return `${getFormat(formatId).name} has no encounter difficulty rules in Dungeon Books.`;

      const templates = useCharacters.getState().templates;
      const inIt = (existing?.combatants ?? []).flatMap((c) => templates.filter((t) => t.id === c.templateId).map((t) => ({ t, side: c.side.trim() })));
      const pcLevels = inIt.filter(({ t }) => t.kind === 'pc').map(({ t }) => characterLevel(t) ?? 1);
      const party = partyArg(party_levels, pcLevels);

      const all: Foe[] = [];
      // The encounter's NPCs not on the party's side.
      for (const { t, side } of inIt) {
        if (t.kind !== 'npc' || side === 'Party') continue;
        const sb = t.statBlock as { challengeRating?: string; level?: number } | null;
        if (sb?.challengeRating) all.push({ cr: sb.challengeRating });
        else if (typeof sb?.level === 'number') all.push({ level: sb.level });
      }
      if (foes !== undefined && !Array.isArray(foes)) throw new ToolError('foes must be a list.');
      for (const raw of (foes ?? []) as Record<string, unknown>[]) {
        const count = typeof raw.count === 'number' && raw.count >= 1 ? Math.floor(raw.count) : 1;
        let foe: Foe | null = null;
        if (typeof raw.creature === 'string') foe = (await findCreature(raw.creature, formatId)).foe;
        else if (typeof raw.cr === 'string') foe = { cr: raw.cr };
        else if (typeof raw.level === 'number') foe = { level: raw.level };
        if (!foe) throw new ToolError('Each foe needs a creature (with a stat block), a cr or a level.');
        for (let i = 0; i < count; i++) all.push(foe);
      }
      const result = rater(party.levels, all);
      if (!result) return 'Nothing to rate: give at least one foe (and a party).';
      return [`${all.length} foe${all.length === 1 ? '' : 's'} against a party of ${party.levels.length} (levels ${party.levels.join(', ')}).`, party.note, `Difficulty: ${difficultyText(result)}`]
        .filter(Boolean)
        .join('\n');
    },
  },
];
