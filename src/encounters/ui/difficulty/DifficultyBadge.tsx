/**
 * @file How hard an encounter is, as a small badge: the rating and the
 * foes' XP, with the party's thresholds and any caveats in its tooltip.
 * Shown in the encounter header and, live, in the builder's cart.
 */
import type { FormatId } from 'campaign-link/formats/formatIds';
import { useActiveCampaign } from '../../../campaigns/campaignStore';
import { rateMembers, type Member } from '../../domain/difficulty/members';
import './difficulty.css';

const xp = (n: number) => `${n.toLocaleString()} XP`;

/** Nothing when the format has no rating, or there is no party or no foe to rate. */
export function DifficultyBadge({ formatId, members }: { formatId: FormatId; members: Member[] }) {
  const party = useActiveCampaign()?.party;
  const result = rateMembers(formatId, members, party);
  if (!result) return null;
  const tooltip = [
    `Foes: ${xp(result.xp)}`,
    ...result.thresholds.map((t) => `${t.name}: up to ${xp(t.xp)}`),
    ...result.notes,
    `Rules: ${result.source}`,
  ].join('\n');
  const tone = result.rating.toLowerCase().replace(/\s+/g, '-');
  return (
    <span className={`difficulty-badge difficulty-${tone}`} title={tooltip}>
      {result.rating} · {xp(result.xp)}
    </span>
  );
}
