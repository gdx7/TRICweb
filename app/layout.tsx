export const metadata = {
  title: "TRIC-seq Interactome Explorer",
  description: "Explore bacterial RNA–RNA interactomes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  );
}
