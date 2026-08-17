'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/users', label: 'Utilisateurs' },
  { href: '/reports', label: 'Signalements' },
  { href: '/support', label: 'Support' },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active ? 'bg-brand-500 text-white shadow-[0_8px_20px_-8px_rgba(53,184,252,0.7)]' : 'text-slate hover:bg-brand-mist hover:text-ink'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
