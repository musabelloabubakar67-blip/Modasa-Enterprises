import { formatDateTime } from "@/lib/dates";
import { formatQty } from "@/lib/quantity";
import { MOVEMENT_LABELS } from "./labels";

export function MovementList({
  movements,
  showBatch,
  showItem = false,
  names,
}: {
  movements: {
    id: number;
    created_at: string;
    type: string;
    quantity: number;
    batch: string;
    note: string | null;
    locations: { code: string } | null;
    created_by: string | null;
    skus?: { code: string; variant_label: string | null; products: { name: string } } | null;
  }[];
  showBatch: boolean;
  showItem?: boolean;
  names: Map<string, string>;
}) {
  if (movements.length === 0) return <p className="card text-muted mt-2 p-4 text-sm">No movements yet.</p>;
  return (
    <div className="card mt-2 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted border-border border-b text-left">
          <tr>
            <th className="p-3 font-medium">When</th>
            {showItem && <th className="p-3 font-medium">Item</th>}
            <th className="p-3 font-medium">Where</th>
            <th className="p-3 font-medium">What</th>
            {showBatch && <th className="p-3 font-medium">Batch</th>}
            <th className="p-3 text-right font-medium">Change</th>
            <th className="p-3 font-medium">By</th>
            <th className="p-3 font-medium">Note</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {movements.map((m) => (
            <tr key={m.id}>
              <td className="p-3 whitespace-nowrap tabular-nums">{formatDateTime(m.created_at)}</td>
              {showItem && (
                <td className="p-3">
                  {m.skus?.products.name}
                  {m.skus?.variant_label && ` · ${m.skus.variant_label}`}
                  <span className="text-muted ml-1 font-mono text-xs">{m.skus?.code}</span>
                </td>
              )}
              <td className="p-3 font-mono text-xs">{m.locations?.code}</td>
              <td className="p-3">{MOVEMENT_LABELS[m.type] ?? m.type}</td>
              {showBatch && <td className="p-3">{m.batch || "–"}</td>}
              <td
                className={`p-3 text-right font-medium tabular-nums ${Number(m.quantity) > 0 ? "text-success" : "text-danger"}`}
              >
                {Number(m.quantity) > 0 ? "+" : ""}
                {formatQty(Number(m.quantity))}
              </td>
              <td className="p-3">{(m.created_by && names.get(m.created_by)) ?? "System"}</td>
              <td className="text-muted p-3">{m.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
