"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/popular", label: "Popular", icon: null },
  { href: "/search", label: "Search", icon: Search },
  { href: "/favorites", label: "Favorites", icon: Heart },
];

export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-1">
      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              active ? "text-netflix" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            {item.label}
            {active && (
              <span className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-netflix" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
