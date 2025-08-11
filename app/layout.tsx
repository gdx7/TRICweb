// app/layout.tsx
import "./globals.css";
import Link from "next/link";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "TRIC-seq Interactome Explorer",
  description: "Explore RNA–RNA interactomes: globalMAP, csMAP, pairMAP, foldMAP",
  icons: { icon: "/tric-logo.png" }, // use tric logo as favicon
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();

  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        {/* Global header */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80">
              <img
                src="/tric-logo.png"
                alt="TRIC-seq logo"
                className="h-7 w-7"
              />
              <span className="text-lg font-semibold">TRIC-seq Interactome Explorer</span>
            </Link>
            <nav className="flex items-center gap-2">
              <Link className="px-3 py-1 rounded hover:bg-slate-100" href="/global">globalMAP</Link>
              <Link className="px-3 py-1 rounded hover:bg-slate-100" href="/csmap">csMAP</Link>
              <Link className="px-3 py-1 rounded hover:bg-slate-100" href="/pairmap">pairMAP</Link>
              <Link className="px-3 py-1 rounded hover:bg-slate-100" href="/foldmap">foldMAP</Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        {/* Lab badge footer */}
        <footer className="mt-16 border-t bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 flex flex-col items-center gap-3">
            <a href="https://www.drna.nl" target="_blank" rel="noreferrer" className="opacity-90 hover:opacity-100">
              <img src="/drna-logo.png" alt="dRNA Lab logo" className="h-14 w-auto" />
            </a>
            <a href="https://www.drna.nl" target="_blank" rel="noreferrer" className="text-sm text-slate-500">
              a <em className="italic lowercase">drna lab</em> production
            </a>
          </div>
        </footer>

        {/* Slim academic-style footer */}
        <footer className="bg-white border-t">
          <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
            <div>© {year} dRNA Lab — All rights reserved.</div>
            <div className="flex items-center gap-4">
              <a className="hover:text-slate-700" href="https://www.drna.nl" target="_blank" rel="noreferrer">drna.nl</a>
              <span className="hidden sm:inline">•</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
