'use client';

import {
  AlertTriangle,
  LayoutDashboard,
  LifeBuoy,
  MessagesSquare,
  PlaneTakeoff,
  ShieldAlert,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number }> };

const SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [{ href: '/', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
  {
    title: 'Comptes',
    items: [
      { href: '/users', label: 'Utilisateurs', icon: Users },
      { href: '/risk', label: 'Comptes à risque', icon: ShieldAlert },
    ],
  },
  {
    title: 'Activité',
    items: [
      { href: '/trips', label: 'Trajets', icon: PlaneTakeoff },
      { href: '/conversations', label: 'Conversations', icon: MessagesSquare },
      { href: '/revenue', label: 'Revenus', icon: Wallet },
    ],
  },
  {
    title: 'Modération',
    items: [
      { href: '/reports', label: 'Signalements', icon: AlertTriangle },
      { href: '/support', label: 'Support', icon: LifeBuoy },
    ],
  },
];

export function NavLinks({ pendingReports = 0, openTickets = 0 }: { pendingReports?: number; openTickets?: number }) {
  const pathname = usePathname();

  const badgeFor = (href: string) => {
    if (href === '/reports' && pendingReports > 0) return pendingReports;
    if (href === '/support' && openTickets > 0) return openTickets;
    return null;
  };

  return (
    <nav className="flex flex-col gap-5">
      {SECTIONS.map((section, i) => (
        <div key={section.title ?? i} className="flex flex-col gap-1">
          {section.title && (
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted">{section.title}</p>
          )}
          {section.items.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const badge = badgeFor(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-brand-500 text-white shadow-[0_8px_20px_-8px_rgba(53,184,252,0.7)]'
                    : 'text-slate hover:bg-brand-mist hover:text-ink'
                }`}
              >
                <item.icon size={17} />
                <span className="flex-1">{item.label}</span>
                {badge !== null && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
