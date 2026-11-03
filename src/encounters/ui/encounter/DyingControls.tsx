/**
 * @file Dying display and controls for each format's dying rules: 5e death
 * save pips and +1/+2 buttons, PF2e Dying value and recovery check buttons,
 * PF1e stabilization check buttons.
 */
import {
  DEATH_SAVE_LIMIT,
  recordDeathSave,
  recordRecoveryCheck,
  recordStabilizationCheck,
} from '../../domain/combat/dying';
import type { CombatRules } from '../../domain/combat/rules';
import type { Combatant } from '../../domain/combat/types';
import type { Id } from '../../domain/ids';
import { runCombatAction } from '../../state/combatStore';

/** 5e: the four death save buttons and what each records. */
const DEATH_SAVE_OPTIONS = [
  { successes: 1, failures: 0, label: '+1 Success', tone: 'heal' },
  { successes: 2, failures: 0, label: '+2 Successes', tone: 'heal' },
  { successes: 0, failures: 1, label: '+1 Failure', tone: 'damage' },
  { successes: 0, failures: 2, label: '+2 Failures', tone: 'damage' },
] as const;

/** PF2e: recovery check degrees of success and how each changes Dying. */
const RECOVERY_OPTIONS = [
  { change: -2, label: 'Critical success', tone: 'heal' },
  { change: -1, label: 'Success', tone: 'heal' },
  { change: 1, label: 'Failure', tone: 'damage' },
  { change: 2, label: 'Critical failure', tone: 'damage' },
] as const;

/** Short label for a dying combatant: badge text and status line. */
export function dyingLabel(rules: CombatRules): string {
  return rules.dying.kind === 'deathSaves' ? 'Death saves' : 'Dying';
}

/** Heading for the dying tracker in the side panel. */
export function dyingTrackerTitle(rules: CombatRules): string {
  switch (rules.dying.kind) {
    case 'deathSaves':
      return 'Death saves';
    case 'dyingValue':
      return 'Recovery checks';
    default:
      return 'Stabilization';
  }
}

/** Progress so far: success/failure pips (5e) or the Dying value (PF2e); nothing for negative HP (HP shows it). */
export function DyingTally({ combatant: c, rules }: { combatant: Combatant; rules: CombatRules }) {
  if (rules.dying.kind === 'dyingValue') {
    return <span className="dying-value" title={`Dies at Dying ${rules.dying.deathAt}, less Doomed`}>{c.dying.value}</span>;
  }
  if (rules.dying.kind !== 'deathSaves') return null;
  const pips = (n: number, cls: string) =>
    Array.from({ length: DEATH_SAVE_LIMIT }, (_, i) => <span key={i} className={`pip ${cls}${i < n ? ' filled' : ''}`} />);
  return (
    <span className="death-tally" title={`${c.dying.successes} successes, ${c.dying.failures} failures`}>
      {pips(c.dying.successes, 'success')}
      <span className="pip-gap" />
      {pips(c.dying.failures, 'failure')}
    </span>
  );
}

/** Buttons recording this turn's dying roll (logged for undo). */
export function DyingButtons({ encounterId, combatant: c, rules }: { encounterId: Id; combatant: Combatant; rules: CombatRules }) {
  // Records a roll labelled with the combatant's name (for undo).
  const run = (label: string, fn: Parameters<typeof runCombatAction>[2]) =>
    runCombatAction(encounterId, `${c.name}: ${label}`, fn);

  let buttons: { label: string; tone: string; onClick(): void }[] = [];
  if (rules.dying.kind === 'deathSaves') {
    buttons = DEATH_SAVE_OPTIONS.map((o) => ({
      ...o,
      onClick: () => run(`death save ${o.label}`, (enc) => recordDeathSave(enc, c.id, o)),
    }));
  } else if (rules.dying.kind === 'dyingValue') {
    buttons = RECOVERY_OPTIONS.map((o) => ({
      ...o,
      onClick: () => run(`recovery check ${o.label}`, (enc, r) => recordRecoveryCheck(enc, c.id, o.change, r)),
    }));
  } else if (rules.dying.kind === 'negativeHp') {
    buttons = [
      { label: 'Stabilized', tone: 'heal', onClick: () => run('stabilized', (enc, r) => recordStabilizationCheck(enc, c.id, true, r)) },
      {
        label: c.currentHp === null ? 'Failed' : 'Failed (−1 HP)',
        tone: 'damage',
        onClick: () => run('failed to stabilize', (enc, r) => recordStabilizationCheck(enc, c.id, false, r)),
      },
    ];
  }
  if (buttons.length === 0) return null;
  return (
    <div className="row wrap death-save-buttons" onClick={(e) => e.stopPropagation()}>
      {buttons.map((b) => (
        <button key={b.label} className={b.tone} onClick={b.onClick}>
          {b.label}
        </button>
      ))}
    </div>
  );
}
