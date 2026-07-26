'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plane, LayoutDashboard, Compass, BookOpen, Moon, Sun } from 'lucide-react';

export default function Nav() {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains('dark')); }, []);
  const toggle = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle('dark', d);
    try { localStorage.setItem('flydeal-theme', d ? 'dark' : 'light'); } catch {}
  };
  const links = [
    { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
    { href: '/strategies', label: 'Stratégies', icon: BookOpen },
    { href: '/contournements', label: 'Contournements', icon: Compass },
  ];
  return (
    <header className="sticky top-0 z-40 glass !rounded-none border-x-0 border-t-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <span className="bg-accent text-white rounded-xl p-1.5"><Plane size={18} /></span>
          FlyDeal
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                pathname === href ? 'bg-accent text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
          <button onClick={toggle} aria-label="Basculer le thème" className="ml-1 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </nav>
      </div>
    </header>
  );
}
