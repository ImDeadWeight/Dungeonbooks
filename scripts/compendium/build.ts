/**
 * @file Builds public/compendium/ from the 5e-bits 5e-database monster
 * files (SRD content only; https://github.com/5e-bits/5e-database). Run
 * from the repo root with the folder holding the two downloaded files:
 *
 *   npx vite-node scripts/compendium/build.ts -- <folder>
 *
 * where <folder> has 2014/5e-SRD-Monsters.json and 2024/5e-SRD-Monsters.json
 * (src/2014/en and src/2024/en in that repository). Every stat block is
 * checked with the format's own sanitizer, as an import would be.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFormat } from 'campaign-link/formats/registry';
import type { FormatId } from 'campaign-link/formats/formatIds';
import { FIVE_E_BITS_NOTICE, SRD_5_1_NOTICE, SRD_5_2_1_NOTICE } from '../../src/encounters/domain/compendium/attribution';
import { COMPENDIUM_FILES, type CompendiumFile } from '../../src/encounters/domain/compendium/types';
import { convertMonster, type SrdMonster } from './srd5e';

const source = process.argv.slice(2).filter((a) => a !== '--')[0];
if (!source) throw new Error('Give the folder holding 2014/5e-SRD-Monsters.json and 2024/5e-SRD-Monsters.json.');

const builds: { formatId: FormatId; input: string; name: string; notice: string }[] = [
  { formatId: 'dnd5e', input: '2014/5e-SRD-Monsters.json', name: 'SRD 5.1', notice: SRD_5_1_NOTICE },
  { formatId: 'dnd5e2024', input: '2024/5e-SRD-Monsters.json', name: 'SRD 5.2.1', notice: SRD_5_2_1_NOTICE },
];

mkdirSync('public/compendium', { recursive: true });
for (const b of builds) {
  const monsters = JSON.parse(readFileSync(join(source, b.input), 'utf8')) as SrdMonster[];
  const format = getFormat(b.formatId);
  const entries = monsters
    .map(convertMonster)
    .map((e) => ({ ...e, statBlock: format.sanitizeStatBlock(e.statBlock, e.id) }))
    .sort((a, z) => a.name.localeCompare(z.name));
  const file: CompendiumFile = {
    format: 'dungeon-books-compendium',
    version: 1,
    formatId: b.formatId,
    source: b.name,
    attribution: `${b.notice} ${FIVE_E_BITS_NOTICE}`,
    entries,
  };
  const out = join('public/compendium', COMPENDIUM_FILES[b.formatId]!);
  writeFileSync(out, JSON.stringify(file));
  console.log(`${out}: ${entries.length} creatures`);
}
