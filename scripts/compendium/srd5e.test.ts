import { describe, expect, it } from 'vitest';
import { convertMonster, crText, parseHitDice, type SrdMonster } from './srd5e';

const goblin: SrdMonster = {
  index: 'goblin',
  name: 'Goblin',
  size: 'Small',
  type: 'humanoid',
  subtype: 'goblinoid',
  alignment: 'neutral evil',
  armor_class: [{ type: 'armor', value: 15, armor: [{ name: 'Leather Armor' }, { name: 'Shield' }] }],
  hit_points: 7,
  hit_points_roll: '2d6',
  speed: { walk: '30 ft.' },
  strength: 8,
  dexterity: 14,
  constitution: 10,
  intelligence: 10,
  wisdom: 8,
  charisma: 8,
  proficiencies: [
    { value: 6, proficiency: { index: 'skill-stealth' } },
    { value: 4, proficiency: { index: 'skill-sleight-of-hand' } },
    { value: 4, proficiency: { index: 'saving-throw-dex' } },
  ],
  damage_vulnerabilities: [],
  damage_resistances: [],
  damage_immunities: [],
  condition_immunities: [{ name: 'Poisoned' }],
  senses: { darkvision: '60 ft.', passive_perception: 9 },
  languages: 'Common, Goblin',
  challenge_rating: 0.25,
  special_abilities: [{ name: 'Nimble Escape', desc: 'Disengage or Hide as a bonus action.' }],
  actions: [{ name: 'Fire Breath', desc: 'Whoosh.', usage: { type: 'recharge on roll', dice: '1d6', min_value: 5 } }],
  legendary_actions: [],
};

describe('converting SRD creatures', () => {
  it('fills the stat block, deriving proficiency and expertise from the bonuses', () => {
    const { id, name, cr, type, statBlock } = convertMonster(goblin);
    expect({ id, name, cr, type }).toEqual({ id: 'goblin', name: 'Goblin', cr: '1/4', type: 'humanoid' });
    expect(statBlock).toMatchObject({
      size: 'Small',
      creatureType: 'humanoid (goblinoid)',
      armorClass: 15,
      armorNote: 'leather armor, shield',
      hitDice: { count: 2, sides: 6, bonus: 0 },
      speed: '30 ft.',
      challengeRating: '1/4',
      // DEX +2, PB +2: +6 is expertise, +4 proficient.
      skills: { stealth: 'expertise', sleightOfHand: 'proficient' },
      conditionImmunities: 'poisoned',
      senses: 'darkvision 60 ft., passive Perception 9',
      traits: [{ name: 'Nimble Escape', description: 'Disengage or Hide as a bonus action.' }],
      actions: [{ name: 'Fire Breath (Recharge 5–6)', description: 'Whoosh.' }],
    });
    expect((statBlock as { savingThrows: Record<string, boolean> }).savingThrows.dex).toBe(true);
  });

  it('writes speeds walk first, with hover after fly', () => {
    const flyer = convertMonster({ ...goblin, speed: { fly: '60 ft.', walk: '10 ft.', hover: true } });
    expect((flyer.statBlock as { speed: string }).speed).toBe('10 ft., fly 60 ft. (hover)');
  });

  it('reads fractional challenge ratings and hit dice with spaces', () => {
    expect([crText(0.125), crText(0.5), crText(17)]).toEqual(['1/8', '1/2', '17']);
    expect(parseHitDice('20d10 + 40')).toEqual({ count: 20, sides: 10, bonus: 40 });
    expect(parseHitDice('none')).toBeNull();
  });
});
