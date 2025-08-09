// app/layout.tsx
import "./globals.css";
import Link from "next/link";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "TRIC-seq Interactome Explorer",
  description: "Explore E. coli RNA–RNA interactomes: globalMAP, csMAP, pairMAP",
  icons: { icon: "/drna-logo.png" }, // optional favicon if you want
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        {/* Global header — visible on every page */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
            <Link href="/" className="text-lg font-semibold hover:opacity-80">
              TRIC-seq Interactome Explorer
            </Link>
            <nav className="flex items-center gap-2">
              <Link className="px-3 py-1 rounded hover:bg-slate-100" href="/global">globalMAP</Link>
              <Link className="px-3 py-1 rounded hover:bg-slate-100" href="/csmap">csMAP</Link>
              <Link className="px-3 py-1 rounded hover:bg-slate-100" href="/pairmap">pairMAP</Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        {/* Global footer with your lab logo */}
        <footer className="mt-16 border-t bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 flex flex-col items-center gap-3">
            <a href="https://www.drna.nl" target="_blank" rel="noreferrer" className="opacity-90 hover:opacity-100">
              <img src="/drna-logo.png" alt="dRNA Lab logo" className="h-14 w-auto" />
            </a>
            <a href="https://www.drna.nl" target="_blank" rel="noreferrer" className="text-sm text-slate-500">
              a <span className="font-medium">dRNA Lab</span> production
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
