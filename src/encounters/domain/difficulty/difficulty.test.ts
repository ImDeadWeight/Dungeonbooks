import { describe, expect, it } from 'vitest';
import { createEmptyStatBlock } from 'campaign-link/formats/dnd5e/statBlock';
import { createEmptyPf2eStatBlock as createPf2e } from 'campaign-link/formats/pf2e/statBlock';
import type { CharacterTemplate } from '../characters';
import { rate5e } from './dnd5e';
import { rateMembers } from './members';
import { ratePf2e } from './pf2e';

describe('5e difficulty (SRD 5.2.1)', () => {
  it('sums each character’s budget and the foes’ XP by CR', () => {
    // Four level 1 characters: Low 200, Moderate 300, High 400. Four goblins (CR 1/4) are 200 XP.
    const result = rate5e([1, 1, 1, 1], Array.from({ length: 4 }, () => ({ cr: '1/4' })))!;
    expect(result.thresholds).toEqual([
      { name: 'Low', xp: 200 },
      { name: 'Moderate', xp: 300 },
      { name: 'High', xp: 400 },
    ]);
    expect(result).toMatchObject({ xp: 200, rating: 'Low' });
  });

  it('adds up mixed levels, and goes beyond High', () => {
    const result = rate5e([5, 3], [{ cr: '5' }])!;
    // High: 1,100 + 400 = 1,500; a CR 5 creature is 1,800 XP.
    expect(result.thresholds[2].xp).toBe(1500);
    expect(result.rating).toBe('Beyond High');
  });

  it('needs a party and a foe', () => {
    expect(rate5e([], [{ cr: '1' }])).toBeNull();
    expect(rate5e([1], [])).toBeNull();
  });
});

describe('PF2e threat (GM Core)', () => {
  it('prices creatures by level against the party and adjusts the budget for party size', () => {
    // Four level 3 PCs; two level 3 creatures (40 each) are Moderate (80).
    expect(ratePf2e([3, 3, 3, 3], [{ level: 3 }, { level: 3 }])).toMatchObject({ xp: 80, rating: 'Moderate' });
    // Five PCs: Low is 60 + 20 = 80 and Moderate 100, so the same 80 XP is only Low.
    const five = ratePf2e([3, 3, 3, 3, 3], [{ level: 3 }, { level: 3 }])!;
    expect(five.thresholds.find((t) => t.name === 'Low')!.xp).toBe(80);
    expect(five.rating).toBe('Low');
  });

  it('counts creatures far below as nothing and far above at the chart’s top, with a note', () => {
    const result = ratePf2e([5, 5, 5, 5], [{ level: 0 }, { level: 10 }])!;
    expect(result.xp).toBe(160);
    expect(result.notes).toHaveLength(2);
  });
});

describe('rating an encounter from its members', () => {
  const t = (kind: 'pc' | 'npc', statBlock: object, formatId: CharacterTemplate['formatId'] = 'dnd5e'): CharacterTemplate => ({
    id: Math.random().toString(),
    name: kind,
    kind,
    formatId,
    tagIds: [],
    deathSaves: kind === 'pc',
    statBlock: statBlock as CharacterTemplate['statBlock'],
  });
  const pc = t('pc', { ...createEmptyStatBlock(), level: 1 });
  const goblin = t('npc', { ...createEmptyStatBlock(), challengeRating: '1/4' });

  it('leaves allies on the party’s side out', () => {
    const members = [
      { template: pc, side: '' },
      { template: goblin, side: '' },
      { template: goblin, side: 'Party' },
    ];
    expect(rateMembers('dnd5e', members)!.xp).toBe(50);
  });

  it('uses the campaign party when there are no PCs, and says so', () => {
    const result = rateMembers('dnd5e', [{ template: goblin, side: '' }], { size: 4, level: 1 })!;
    expect(result.thresholds[0].xp).toBe(200);
    expect(result.notes[0]).toContain('party of 4 at level 1');
  });

  it('has no rating for formats without encounter rules', () => {
    expect(rateMembers('bx', [{ template: pc, side: '' }, { template: goblin, side: '' }])).toBeNull();
  });

  it('rates PF2e by level', () => {
    const hero = t('pc', { ...createPf2e(), level: 2 }, 'pf2e');
    const ogre = t('npc', { ...createPf2e(), level: 3 }, 'pf2e');
    expect(rateMembers('pf2e', [{ template: hero, side: '' }, { template: ogre, side: '' }])).toMatchObject({ xp: 60 });
  });
});
