import { ExplorerProvider } from "@/lib/explore/store";
import { ExplorerShell } from "@/components/explore/ExplorerShell";

export const metadata = {
  title: "TRIC-seq Explorer — one RNA, every lens",
  description:
    "A unified, interactive explorer for bacterial RNA–RNA interactomes: genome-wide partners, base-pairing contact maps, intramolecular folds and comparative spectra — all driven by one focal RNA.",
};

export default function ExplorePage() {
  return (
    <ExplorerProvider>
      <ExplorerShell />
    </ExplorerProvider>
  );
}
