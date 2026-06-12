// app/layout.tsx
import "./globals.css";
import { Inter, Sora } from "next/font/google";
import { SiteFrame } from "../components/SiteFrame";

const inter = Inter({ subsets: ["latin"] });
const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata = {
  title: "TRIC-seq Explorer",
  description: "Explore bacterial RNA–RNA interactomes and structures in one seamless workspace.",
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
        <SiteFrame soraClass={sora.className}>{children}</SiteFrame>
      </body>
    </html>
  );
}
