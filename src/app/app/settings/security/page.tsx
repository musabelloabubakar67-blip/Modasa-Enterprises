import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { BUSINESS_TIME_ZONE, formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = { access: "Logins & staff", money: "Money", stock: "Stock", settings: "Settings" } as const;
type Category = keyof typeof CATEGORIES;

const PERIODS = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", all: "Everything" } as const;
type Period = keyof typeof PERIODS;

const PAGE_SIZE = 100;

const REF_LINKS: Record<string, (id: string) => string> = {
  sale: (id) => `/app/sales/${id}`,
  adjustment: (id) => `/app/stock/adjustments/${id}`,
  transfer: (id) => `/app/transfers/${id}`,
  online_order: (id) => `/app/online-orders/${id}`,
  shift: () => "/app/sales/shifts",
};

const pick = <T extends string>(value: unknown, allowed: Record<T, unknown>, fallback: T) =>
  typeof value === "string" && value in allowed ? (value as T) : fallback;

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: BUSINESS_TIME_ZONE });
/** The moment `days` days ago, for the period filter. */
const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE }).format(new Date(iso));

/**
 * The owner's security log: logins and staff changes, refunds and till differences, stock corrections and
 * settings, one plain sentence each. Written by the database (see the security_log migration); read-only here.
 */
export default async function SecurityLogPage({ searchParams }: PageProps<"/app/settings/security">) {
  await requireStaff(["owner"]);
  const params = await searchParams;
  const category = pick<Category | "all">(params.type, { all: 1, ...CATEGORIES }, "all");
  const period = pick<Period>(params.period, PERIODS, "30");
  const person = typeof params.person === "string" && /^[0-9a-f-]{36}$/.test(params.person) ? params.person : "";
  const before = Number(params.before) > 0 ? Number(params.before) : null;

  const supabase = await createClient();
  let query = supabase
    .from("security_log")
    .select("id, at, category, actor_id, actor_name, location_name, summary, details, ref_kind, ref_id")
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (category !== "all") query = query.eq("category", category);
  if (period !== "all") query = query.gte("at", since(Number(period)));
  if (person) query = query.eq("actor_id", person);
  if (before) query = query.lt("id", before);

  const [{ data: rows, error }, { data: staff }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  if (error) throw error;

  const entries = rows.slice(0, PAGE_SIZE);
  const older = rows.length > PAGE_SIZE ? entries[entries.length - 1].id : null;
  const days = new Map<string, typeof entries>();
  for (const e of entries) days.set(day(e.at), [...(days.get(day(e.at)) ?? []), e]);

  const olderHref = () => {
    const sp = new URLSearchParams({ type: category, period, ...(person && { person }), before: String(older) });
    return `/app/settings/security?${sp}`;
  };

  return (
    <div className="space-y-4">
      <p className="text-muted text-sm">
        Who did what on the staff site: logins and staff changes, refunds, till differences, price changes, stock
        corrections and settings. Ordinary sales and deliveries aren&apos;t listed. Only you can see this, and nobody
        can change or delete it.
      </p>

      <form className="card flex flex-wrap items-end gap-2 p-3">
        <label>
          <span className="label text-xs">Type</span>
          <select name="type" defaultValue={category} className="input w-auto">
            <option value="all">Everything</option>
            {Object.entries(CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label text-xs">Person</span>
          <select name="person" defaultValue={person} className="input w-auto">
            <option value="">Everyone</option>
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label text-xs">Period</span>
          <select name="period" defaultValue={period} className="input w-auto">
            {Object.entries(PERIODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary">
          Show
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="card text-muted p-6 text-center text-sm">Nothing recorded for these choices.</p>
      ) : (
        [...days].map(([date, list]) => (
          <section key={date}>
            <h2 className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">{formatDate(date)}</h2>
            <ul className="card divide-border divide-y">
              {list.map((e) => {
                const details = Array.isArray(e.details) ? (e.details as string[]) : null;
                const meta = e.details && !Array.isArray(e.details) ? (e.details as { last_at?: string }) : null;
                const link = e.ref_kind && e.ref_id ? REF_LINKS[e.ref_kind]?.(e.ref_id) : null;
                return (
                  <li key={e.id} className="flex gap-3 px-3 py-2 text-sm">
                    <span className="text-muted w-12 shrink-0 tabular-nums">{time(e.at)}</span>
                    <div className="min-w-0 flex-1">
                      <p>
                        {e.actor_name ? (
                          <>
                            <strong>{e.actor_name}</strong> {e.summary}
                          </>
                        ) : (
                          e.summary
                        )}
                        {meta?.last_at && time(meta.last_at) !== time(e.at) && (
                          <span className="text-muted"> (last at {time(meta.last_at)})</span>
                        )}
                      </p>
                      {details && details.length > 2 && (
                        <details className="text-muted mt-1 text-xs">
                          <summary className="cursor-pointer">Show all {details.length}</summary>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            {details.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                    <div className="text-muted flex shrink-0 flex-col items-end gap-0.5 text-xs">
                      {e.location_name && <span>{e.location_name}</span>}
                      {link && (
                        <Link href={link} className="text-accent hover:underline">
                          View
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {older && (
        <Link href={olderHref()} className="btn btn-secondary">
          Older entries
        </Link>
      )}
    </div>
  );
}
