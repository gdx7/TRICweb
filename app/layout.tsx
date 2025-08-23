// app/layout.tsx
import type { Metadata } from "next";
import TopBar from "./components/TopBar";
import "./globals.css"; // keep if you already have it

export const metadata: Metadata = {
  title: "TRIC‑seq Explorer",
  description:
    "Interactive maps of bacterial RNA–RNA interactions and structures with TRIC‑seq.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TopBar />
        <main className="page-wrap">{children}</main>
        <style jsx global>{`
          .page-wrap {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1.25rem 1rem 3rem;
          }
        `}</style>
      </body>
    </html>
  );
}
