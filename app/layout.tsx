// app/layout.tsx
import "./globals.css";
import Link from "next/link";
import { Inter, Sora } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
const sora = Sora({ subsets: ["latin"] });

export const metadata = {
  title: "TRIC-seq Interactome Explorer",
  description: "Explore RNA–RNA interactomes: globalMAP, csMAP, pairMAP, foldMAP",
  icons: {
    icon: "/tric-logo.png",
    shortcut: "/tric-logo.png",
    apple: "/tric-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        {/* Global header */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90">
              <img
                src="/tric-logo.png"
                alt="TRIC-seq logo"
                className="h-7 w-7 rounded-sm"
              />
              <span className={`${sora.className} text-2xl tracking-wide`}>
                TRIC-seq Interactome Explorer
              </span>
            </Link>

            <nav className={`${sora.className} flex items-center gap-2 tracking-wide`}>
              <Link className="px-3 py-1 rounded hover:bg-slate-100" href="/global">globalMAP</Link>
              <Link className="px-3 py-1 rounded hover:bg-slate-100" href="/csmap">csMAP</Link>
              <Link className="px-3 py-1 rounded hover:bg-slate-100" href="/pairmap">pairMAP</Link>
              <Link className="px-3 py-1 rounded hover:bg-slate-100" href="/foldmap">foldMAP</Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        {/* Global footer with lab logo */}
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
      </body>
    </html>
  );
}
