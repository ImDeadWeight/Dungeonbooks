import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyPf2eStatBlock } from 'campaign-link/formats/pf2e/statBlock';
import { useCampaigns } from '../../campaigns/campaignStore';
import type { CharacterTemplate } from '../../encounters/domain/characters';
import { noDyingProgress, type Combatant } from '../../encounters/domain/combat/types';
import { useCharacters } from '../../encounters/state/characterStore';
import { useLibrary } from '../../encounters/state/libraryStore';
import { toolNamed } from '.';
import { outputText } from './types';

const run = async (name: string, args: object = {}) => outputText(await toolNamed(name)!.run(args as Record<string, unknown>));

const pf2e = (id: string, name: string, kind: 'pc' | 'npc', level: number): CharacterTemplate => ({
  id,
  name,
  kind,
  formatId: 'pf2e',
  tagIds: [],
  deathSaves: kind === 'pc',
  statBlock: { ...createEmptyPf2eStatBlock(), level },
});

const combatant = (id: string, templateId: string, name: string, extra: Partial<Combatant> = {}): Combatant => ({
  id,
  templateId,
  name,
  maxHp: 20,
  currentHp: 20,
  tempHp: 0,
  initiative: null,
  addedOrder: 0,
  tokenDescription: '',
  side: '',
  conditions: [],
  status: 'active',
  dying: noDyingProgress(),
  dyingRollMadeThisTurn: false,
  ...extra,
});

beforeEach(() => {
  useCampaigns.setState({ campaigns: [{ id: 'c1', name: 'Veil', formatId: 'pf2e', party: { size: 4, level: 3 } }], activeId: 'c1' });
  useCharacters.setState({ templates: [pf2e('hero', 'Ezren', 'pc', 3), pf2e('ogre', 'Ogre Brute', 'npc', 4), pf2e('wolf', 'Wolf', 'npc', 1)] });
  useLibrary.setState({
    areas: [{ id: 'a1', name: 'Mines', campaignId: 'c1', parentAreaId: null }],
    encounters: [
      {
        id: 'e1',
        name: 'Ogre in the dark',
        campaignId: 'c1',
        areaId: 'a1',
        formatId: 'pf2e',
        combatants: [
          combatant('x1', 'hero', 'Ezren', { initiative: 18 }),
          combatant('x2', 'ogre', 'Ogre Brute', { currentHp: 7, conditions: [{ instanceId: 'i', conditionId: 'c', name: 'Frightened', value: 1, dropsEachTurn: true, requiresResolve: false, resolvedThisTurn: false }] }),
        ],
        combat: { active: true, round: 2, currentId: 'x2' },
      },
      { id: 'e2', name: 'Empty road', campaignId: 'c1', areaId: null, formatId: 'pf2e', combatants: [], combat: { active: false, round: 0, currentId: null } },
    ],
  });
});

describe('encounter tools', () => {
  it('lists encounters by area with their state', async () => {
    const list = await run('list_encounters');
    expect(list).toContain('- Empty road (PF2e; 0 in it; not in combat)');
    expect(list).toContain('Mines:\n- Ogre in the dark (PF2e; 2 in it; in combat, round 2; ');
  });

  it('reads an encounter: combatants, whose turn, difficulty', async () => {
    const text = await run('read_encounter', { encounter: 'ogre' });
    expect(text).toContain('- ▶ Ogre Brute (NPC; HP 7/20; conditions: Frightened 1)');
    expect(text).toContain('- Ezren (PC; HP 20/20; initiative 18)');
    // One level 3 PC against a level 4 ogre: 60 XP, past Extreme for a party of one (160 − 3 × 40 = 40).
    expect(text).toContain('Difficulty: Beyond Extreme (60 XP');
  });

  it('rates a planned fight against the campaign party, or given levels', async () => {
    expect(await run('rate_encounter', { foes: [{ creature: 'Ogre Brute', count: 2 }] })).toContain('Difficulty: Severe (120 XP');
    expect(await run('rate_encounter', { foes: [{ level: 3, count: 2 }], party_levels: [3, 3, 3, 3] })).toContain('Moderate (80 XP');
    await expect(run('rate_encounter', { foes: [{ creature: 'Dragon' }] })).rejects.toThrow('No creature called "Dragon"');
  });

  it('searches and reads creatures', async () => {
    expect(await run('search_creatures', { min_cr: '2' })).toBe('PF2e creatures:\n- Ogre Brute (yours, NPC, level 4; AC 15, HP 15)');
    expect(await run('read_creature', { creature: 'wolf' })).toContain('# Wolf (your character)');
  });

  it('names encounters that are close when one isn’t found', async () => {
    await expect(run('read_encounter', { encounter: 'Dragon lair' })).rejects.toThrow('list_encounters shows them all');
  });
});
