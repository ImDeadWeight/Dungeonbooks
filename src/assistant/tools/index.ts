/**
 * @file Every tool AI apps and the Assistant can use: the notes, maps on
 * pages, and (looking only) encounters and the creature compendium.
 */
import { NOTES_TOOLS } from '../notesTools';
import { ENCOUNTER_TOOLS } from './encounterTools';
import { MAP_TOOLS } from './mapTools';
import type { Tool } from './types';

export const ALL_TOOLS: Tool[] = [...NOTES_TOOLS, ...MAP_TOOLS, ...ENCOUNTER_TOOLS];

/** The tool with this name, if there is one. */
export const toolNamed = (name: unknown): Tool | undefined => ALL_TOOLS.find((t) => t.name === name);
