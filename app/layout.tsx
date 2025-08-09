// app/layout.tsx
export const metadata = { title: "TRIC-seq Interactome Explorer" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

