import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TRIC-seq Explorer",
  description: "Interactive RNA–RNA interactome tools",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
          <nav className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg">TRIC-seq</Link>
            <div className="flex items-center gap-3 text-sm">
              <Link className="px-3 py-1 rounded hover:bg-gray-100" href="/global">globalMAP</Link>
              <Link className="px-3 py-1 rounded hover:bg-gray-100" href="/csmap">csMAP</Link>
              <Link className="px-3 py-1 rounded hover:bg-gray-100" href="/pairmap">pairMAP</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
