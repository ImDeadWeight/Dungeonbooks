/**
 * @file Turns one creature from the 5e-bits 5e-database JSON (SRD 5.1 and
 * SRD 5.2.1 monsters) into a compendium entry with a 5e stat block. Only
 * what the stat block holds is kept; the format derives the rest (ability
 * modifiers, save and skill bonuses).
 */
import { abilityModifier, type Ability } from 'campaign-link/formats/dnd5e/abilities';
import { proficiencyForCr } from 'campaign-link/formats/dnd5e/proficiency';
import { SKILLS, type Skill, type SkillProficiency } from 'campaign-link/formats/dnd5e/skills';
import { createEmptyStatBlock, SIZES, type Dnd5eStatBlock, type NamedEntry, type Size } from 'campaign-link/formats/dnd5e/statBlock';
import type { DiceFormula } from 'campaign-link/formats/dice';
import type { CompendiumEntry } from '../../src/encounters/domain/compendium/types';

/** The parts of a 5e-database monster this reads. */
export interface SrdMonster {
  index: string;
  name: string;
  size: string;
  type: string;
  subtype?: string;
  alignment: string;
  armor_class: { type?: string; value: number; armor?: { name: string }[]; spell?: { name: string }; condition?: { name: string } }[];
  hit_points: number;
  hit_points_roll?: string;
  speed: Record<string, string | boolean>;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  proficiencies: { value: number; proficiency: { index: string } }[];
  damage_vulnerabilities: string[];
  damage_resistances: string[];
  damage_immunities: string[];
  condition_immunities: { name: string }[];
  senses: Record<string, string | number>;
  languages: string;
  challenge_rating: number;
  special_abilities?: SrdEntry[];
  actions?: SrdEntry[];
  bonus_actions?: SrdEntry[];
  reactions?: SrdEntry[];
  legendary_actions?: SrdEntry[];
}

interface SrdEntry {
  name: string;
  desc: string;
  usage?: { type: string; times?: number; dice?: string; min_value?: number; rest_types?: string[] };
}

const ABILITY_KEYS: Record<string, Ability> = { str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha' };

/** "1/8" for 0.125 and so on; whole numbers as they are. */
export function crText(cr: number): string {
  const fractions: Record<number, string> = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' };
  return fractions[cr] ?? String(cr);
}

/** "18d12+126" or "20d10 + 40" as dice; null when it isn't a dice formula. */
export function parseHitDice(text: string | undefined): DiceFormula | null {
  const m = text?.replace(/\s+/g, '').match(/^(\d+)d(\d+)([+-]\d+)?$/);
  return m ? { count: Number(m[1]), sides: Number(m[2]), bonus: Number(m[3] ?? 0) } : null;
}

/** The size, or the first one named ("Medium or small" is Medium). */
function sizeOf(text: string): Size {
  const first = text.split(/\s+/)[0].toLowerCase();
  return SIZES.find((s) => s.toLowerCase() === first) ?? 'Medium';
}

/** What follows the AC number: "natural armor", "leather armor, shield", "with mage armor". */
function armorNote(ac: SrdMonster['armor_class'][number]): string {
  if (ac.armor?.length) return ac.armor.map((a) => a.name.toLowerCase()).join(', ');
  if (ac.type === 'natural') return 'natural armor';
  if (ac.spell) return `with ${ac.spell.name.toLowerCase()}`;
  if (ac.condition) return `while ${ac.condition.name.toLowerCase()}`;
  return '';
}

/** "30 ft., fly 60 ft. (hover), swim 30 ft." */
function speedText(speed: SrdMonster['speed']): string {
  const parts = Object.entries(speed)
    .filter(([key, value]) => key !== 'hover' && typeof value === 'string')
    .sort(([a], [b]) => (a === 'walk' ? -1 : b === 'walk' ? 1 : 0))
    .map(([key, value]) => (key === 'walk' ? String(value) : `${key} ${value}${key === 'fly' && speed.hover ? ' (hover)' : ''}`));
  return parts.join(', ');
}

/** "blindsight 60 ft., darkvision 120 ft." (the stat block works out passive Perception itself). */
function sensesText(senses: SrdMonster['senses']): string {
  return Object.entries(senses)
    .filter(([key]) => key !== 'passive_perception')
    .map(([key, value]) => `${key} ${value}`)
    .join(', ');
}

/** The entry's name with how often it can be used: "Fire Breath (Recharge 5–6)", "Spellcasting (3/Day)". */
function entryName(entry: SrdEntry): string {
  const u = entry.usage;
  if (!u) return entry.name;
  if (u.type === 'recharge on roll' && u.min_value) return `${entry.name} (Recharge ${u.min_value === 6 ? '6' : `${u.min_value}–6`})`;
  if (u.type === 'per day' && u.times) return `${entry.name} (${u.times}/Day)`;
  if (u.type === 'recharge after rest' && u.rest_types?.length) {
    return `${entry.name} (Recharges after a ${u.rest_types.map((r) => `${r[0].toUpperCase()}${r.slice(1)}`).join(' or ')} Rest)`;
  }
  return entry.name;
}

const entries = (list: SrdEntry[] | undefined): NamedEntry[] => (list ?? []).map((e) => ({ name: entryName(e), description: e.desc.trim() }));

/** "skill-animal-handling" → "animalHandling". */
const skillKey = (index: string) => index.replace(/^skill-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Converts one creature. */
export function convertMonster(m: SrdMonster): CompendiumEntry {
  const cr = crText(m.challenge_rating);
  const abilities: Record<Ability, number> = {
    str: m.strength,
    dex: m.dexterity,
    con: m.constitution,
    int: m.intelligence,
    wis: m.wisdom,
    cha: m.charisma,
  };
  const pb = proficiencyForCr(cr);
  const blank = createEmptyStatBlock();
  const savingThrows = { ...blank.savingThrows };
  const skills: Partial<Record<Skill, SkillProficiency>> = {};
  for (const { value, proficiency } of m.proficiencies) {
    const save = proficiency.index.match(/^saving-throw-([a-z]+)$/);
    if (save && ABILITY_KEYS[save[1]]) savingThrows[ABILITY_KEYS[save[1]]] = true;
    if (!proficiency.index.startsWith('skill-')) continue;
    const key = skillKey(proficiency.index);
    if (!(key in SKILLS)) continue;
    // Expertise when the bonus reaches double proficiency.
    const mod = abilityModifier(abilities[SKILLS[key as Skill].ability]);
    skills[key as Skill] = value >= mod + 2 * pb ? 'expertise' : 'proficient';
  }
  const ac = m.armor_class[0];
  const statBlock: Dnd5eStatBlock = {
    ...blank,
    size: sizeOf(m.size),
    creatureType: m.subtype ? `${m.type} (${m.subtype})` : m.type,
    alignment: m.alignment,
    armorClass: ac?.value ?? blank.armorClass,
    armorNote: ac ? armorNote(ac) : '',
    maxHp: m.hit_points,
    hitDice: parseHitDice(m.hit_points_roll),
    speed: speedText(m.speed),
    abilities,
    savingThrows,
    skills,
    challengeRating: cr,
    damageVulnerabilities: m.damage_vulnerabilities.join(', '),
    damageResistances: m.damage_resistances.join(', '),
    damageImmunities: m.damage_immunities.join(', '),
    conditionImmunities: m.condition_immunities.map((c) => c.name.toLowerCase()).join(', '),
    senses: sensesText(m.senses),
    languages: m.languages,
    traits: entries(m.special_abilities),
    actions: entries(m.actions),
    bonusActions: entries(m.bonus_actions),
    reactions: entries(m.reactions),
    legendaryActions: entries(m.legendary_actions),
  };
  return { id: m.index, name: m.name, cr, type: m.type.toLowerCase(), statBlock };
}
