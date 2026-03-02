"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/engagements", label: "Engagements" },
  { href: "/templates", label: "Templates" },
  { href: "/arsenal", label: "Arsenal" },
];

interface NavLinksProps {
  isAdmin?: boolean;
}

export function NavLinks({ isAdmin }: NavLinksProps) {
  const pathname = usePathname();

  const links = isAdmin
    ? [...baseLinks, { href: "/admin", label: "Admin" }]
    : baseLinks;

  return (
    <div className="flex items-center gap-1">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-xs px-3 py-1.5 rounded transition-colors duration-100 ${
              isActive
                ? "text-accent bg-accent/5"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
