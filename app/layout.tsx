// app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "TRIC-seq Interactome Explorer",
  description: "Explore E. coli RNA–RNA interactomes: globalMAP, csMAP, pairMAP",
  icons: { icon: "/drna-logo.png" }, // optional favicon using your logo
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
