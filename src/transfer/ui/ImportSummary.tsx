/**
 * @file The import previews' table: per kind of item, how many in the file
 * are new here, already here, or here with different content.
 */
import type { ItemStatus, PlanItem } from '../../encounters/domain/transfer/plan';

/** Row labels for each item type. */
const TYPE_PLURAL: Record<PlanItem['type'], string> = {
  campaign: 'Campaigns',
  area: 'Areas',
  encounter: 'Encounters',
  character: 'Characters',
};

/** A row of counts. */
type Counts = Record<ItemStatus, number>;

/** Props for ImportSummary: the plan's items, plus extra rows (a campaign file's pages). */
interface Props {
  items: PlanItem[];
  extra?: { label: string; counts: Counts }[];
}

/** Table of new / already present / different counts per item type. */
export function ImportSummary({ items, extra = [] }: Props) {
  const types = (Object.keys(TYPE_PLURAL) as PlanItem['type'][]).filter((t) => items.some((i) => i.type === t));
  // Items of a type with a given status.
  const count = (t: PlanItem['type'], s: ItemStatus) => items.filter((i) => i.type === t && i.status === s).length;
  const rows = [
    ...types.map((t) => ({ label: TYPE_PLURAL[t], counts: { new: count(t, 'new'), identical: count(t, 'identical'), conflict: count(t, 'conflict') } })),
    ...extra,
  ];
  return (
    <table className="import-summary">
      <thead>
        <tr><th /><th>New</th><th>Already present</th><th>Different</th></tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th>{row.label}</th>
            <td>{row.counts.new}</td>
            <td>{row.counts.identical}</td>
            <td>{row.counts.conflict}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
