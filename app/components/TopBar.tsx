// app/components/TopBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type NavItem = { href: string; label: string };

const navItems: NavItem[] = [
  { href: "/globalmap", label: "globalMAP" },
  { href: "/csmap", label: "csMAP" },
  { href: "/pairmap", label: "pairMAP" },
  { href: "/foldmap", label: "foldMAP" },
  { href: "/help", label: "Help" },
];

export default function TopBar() {
  const pathname = usePathname();

  const items = useMemo(() => {
    return navItems.map((item) => {
      const isActive =
        item.href === "/"
          ? pathname === "/"
          : pathname === item.href || pathname.startsWith(item.href + "/");
      return { ...item, isActive };
    });
  }, [pathname]);

  return (
    <header role="banner" className="topbar">
      <div className="wrap">
        <Link href="/" className="brand" aria-label="TRIC-seq Explorer Home">
          TRIC‑seq Explorer
        </Link>

        <nav aria-label="Primary" className="nav">
          {items.map(({ href, label, isActive }) => (
            <Link
              key={href}
              href={href}
              className={`link ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <style jsx>{`
        .topbar {
          border-bottom: 1px solid #e5e7eb;
          background: #ffffffcc;
          backdrop-filter: blur(6px);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .wrap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0.75rem 1rem;
        }
        .brand {
          font-weight: 700;
          letter-spacing: 0.2px;
          text-decoration: none;
        }
        .nav {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .link {
          padding: 0.4rem 0.6rem;
          text-decoration: none;
          border-radius: 6px;
          border: 1px solid transparent;
        }
        .link:hover {
          background: #f3f4f6;
        }
        .link.active {
          border-color: #d1d5db;
          background: #f9fafb;
        }
      `}</style>
    </header>
  );
}
