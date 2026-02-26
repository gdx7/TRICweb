// app/layout.tsx
import "./globals.css";
import Link from "next/link";
import { Inter, Sora } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata = {
  title: "TRIC-seq Interactome Explorer",
  description: "Explore RNA–RNA interactomes: globalMAP, csMAP, pairMAP, foldMAP",
  icons: { icon: "/tric-logo.png" }, // favicon
};

// Lazy load the tour to avoid SSR window issues
import dynamic from "next/dynamic";
const InteractiveTour = dynamic(() => import("../components/InteractiveTour").then(mod => mod.InteractiveTour), { ssr: false });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        <InteractiveTour />
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200 shadow-sm transition-colors">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
            <Link href="/" className={`flex items-center gap-2 hover:opacity-80 ${sora.className}`}>
              <img src="/tric-logo.png" alt="TRIC-seq logo" className="h-7 w-7" />
              <span className="text-lg font-semibold tracking-tight hidden sm:block">TRIC-seq Interactome Explorer</span>
              <span className="text-lg font-semibold tracking-tight sm:hidden">TRIC-seq</span>
            </Link>
            <nav className={`flex items-center gap-1.5 md:gap-2 ${sora.className}`}>
              <div className="flex items-center gap-1.5 md:gap-2">
                <Link className="px-3 py-1.5 text-sm font-medium rounded hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus:outline-none" href="/global">globalMAP</Link>
                <Link className="px-3 py-1.5 text-sm font-medium rounded hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus:outline-none" href="/csmap">csMAP</Link>
                <Link className="px-3 py-1.5 text-sm font-medium rounded hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus:outline-none" href="/pairmap">pairMAP</Link>
                <Link className="px-3 py-1.5 text-sm font-medium rounded hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus:outline-none" href="/foldmap">foldMAP</Link>
                <Link className="px-3 py-1.5 text-sm font-medium rounded hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus:outline-none italic text-slate-500 hover:text-slate-900" href="/help">Help</Link>
              </div>
            </nav>
          </div>
        </header>

        <main className="min-h-[calc(100vh-140px)]">{children}</main>

        {/* Logos + copyright */}
        <footer className="mt-12 border-t border-slate-200 bg-white transition-colors">
          <div className="mx-auto max-w-7xl px-4 py-10 flex flex-col items-center gap-6">
            <div className="flex items-center gap-6 sm:gap-8 flex-wrap justify-center">
              <a href="https://www.drna.nl" target="_blank" rel="noreferrer" className="opacity-90 hover:opacity-100 transition-opacity">
                <img src="/drna-logo.png" alt="dRNA Lab logo" className="h-12 sm:h-14 w-auto" />
              </a>
              <a href="https://sils.uva.nl/" target="_blank" rel="noreferrer" className="opacity-90 hover:opacity-100 transition-opacity">
                <img src="/sils-logo.png" alt="SILS logo" className="h-12 sm:h-14 w-auto" />
              </a>
              <a href="https://www.nwo.nl/en" target="_blank" rel="noreferrer" className="opacity-90 hover:opacity-100 transition-opacity">
                <img src="/NWO-logo.png" alt="NWO logo" className="h-12 sm:h-14 w-auto" />
              </a>
            </div>
            <div className="text-sm text-slate-500 text-center">
              © 2025{" "}
              <a
                className="italic no-underline hover:text-slate-700 transition-colors"
                href="https://www.drna.nl"
                target="_blank"
                rel="noreferrer"
              >
                www.drna.nl
              </a>{" "}
              @{" "}
              <a
                href="https://sils.uva.nl/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-700 transition-colors"
              >
                SILS
              </a>
              ,{" "}
              <a
                href="https://www.uva.nl/en"
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-700 transition-colors"
              >
                UvA
              </a>
            </div>
            <div className="text-sm text-slate-500 text-center">
              Open access:{" "}
              <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noreferrer" className="font-medium hover:text-slate-800 transition-colors">
                MIT License
              </a>{" "}
              (code),{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="font-medium hover:text-slate-800 transition-colors">
                CC BY 4.0
              </a>{" "}
              (data &amp; content)
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
