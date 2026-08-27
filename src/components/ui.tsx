import Link from 'next/link';

const PANEL = 'rounded-2xl border border-hairline bg-white shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]';

export function Panel({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`${PANEL} ${className}`}>{children}</div>;
}

export function PanelHeader({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-slate">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ tint, children }: { tint: string; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${tint}`}>{children}</span>;
}

export function StatTile({
  label,
  value,
  hint,
  accent = 'brand',
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'brand' | 'red' | 'emerald' | 'amber';
  icon?: React.ComponentType<{ size?: number }>;
}) {
  const tint = {
    brand: 'bg-brand-tint text-brand-600',
    red: 'bg-red-100 text-red-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
  }[accent];

  return (
    <div className={`${PANEL} p-4`}>
      {Icon && (
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}>
          <Icon size={17} />
        </div>
      )}
      <p className={`text-2xl font-extrabold text-ink ${Icon ? 'mt-3' : ''}`}>{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted">{label}</p>
      {hint && <p className="mt-1 text-xs text-slate">{hint}</p>}
    </div>
  );
}

export function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-hairline bg-brand-mist text-xs font-semibold uppercase text-slate">
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}

/** Onglets pilotés par l'URL — pas de JS client, et chaque onglet est partageable. */
export function TabBar({
  tabs,
  current,
  hrefFor,
}: {
  tabs: { key: string; label: string; count?: number }[];
  current: string;
  hrefFor: (key: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-hairline pb-px">
      {tabs.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            className={`rounded-t-xl border-b-2 px-3.5 py-2 text-sm font-semibold transition ${
              active
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-slate hover:border-hairline hover:text-ink'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`ml-1.5 text-xs font-bold ${active ? 'text-brand-500' : 'text-muted'}`}>{t.count}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function FilterPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-brand-500 text-white' : 'border border-hairline bg-white text-slate hover:bg-brand-mist'
      }`}
    >
      {children}
    </Link>
  );
}

export const inputClass =
  'rounded-xl border border-hairline bg-brand-mist/60 px-3 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-200';

export const submitClass =
  'rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-[0_10px_25px_-10px_rgba(53,184,252,0.7)] transition hover:bg-brand-600';

export function Avatar({ name, url, size = 32 }: { name: string | null; url?: string | null; size?: number }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from arbitrary remote hosts
    <img src={url} alt="" width={size} height={size} className="flex-shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-brand-tint font-bold text-brand-700"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initial}
    </div>
  );
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-amber-500">{'★'.repeat(Math.round(rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(rating)))}</span>
      <span className="font-semibold text-ink">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="text-xs text-muted">({count})</span>}
    </span>
  );
}
