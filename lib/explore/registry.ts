// lib/explore/registry.ts
// Registry of bundled species datasets. One entry wires up every lens of the
// Explorer: annotations (local), the interaction table (globalMAP / csMAP /
// partners) and the raw chimera contacts (pairMAP / foldMAP).

export type SpeciesId = "EC" | "SA" | "SS" | "MX";
export type DbKey = "EC" | "SS" | "SA" | "BS" | "MX";

export type SpeciesSource = {
  id: SpeciesId;
  /** Short display, e.g. "E. coli". */
  short: string;
  /** Italic latin binomial for headings. */
  latin: string;
  /** One-line flavour shown in the species menu. */
  blurb: string;
  /** Local annotation CSV (public/). */
  annoUrl: string;
  /** Interaction (pairs) CSV — powers Interactome / Compare / Partners. */
  interactionUrl: string;
  /** Long-range chimeras (.bed) — powers Pair contact maps. */
  contactsUrl: string;
  /** All chimeras (.bed) for intramolecular structure; falls back to contacts. */
  structureUrl?: string;
  /** Genome FASTA (public/) for the binding-site predictor; matches anno accession. */
  fastaUrl: string;
  /** Key used to build external gene-database deep links. */
  dbKey: DbKey;
};

const BLOB = "https://6xaweu7axahancgd.public.blob.vercel-storage.com";

export const SPECIES: SpeciesSource[] = [
  {
    id: "EC",
    short: "E. coli",
    latin: "Escherichia coli",
    blurb: "K-12 MG1655 · the reference bacterial interactome",
    annoUrl: "/Anno_EC.csv",
    interactionUrl: `${BLOB}/interaction_EC.csv`,
    contactsUrl: `${BLOB}/LR_chimera_EC.bed`,
    structureUrl: `${BLOB}/chimera_EC_all.bed`,
    fastaUrl: "/EC.fasta",
    dbKey: "EC",
  },
  {
    id: "SA",
    short: "S. aureus",
    latin: "Staphylococcus aureus",
    blurb: "Gram-positive pathogen · sRNA-rich regulation",
    annoUrl: "/Anno_SA.csv",
    interactionUrl: `${BLOB}/interaction_SA.csv`,
    contactsUrl: `${BLOB}/LR_chimera_SA.bed`,
    fastaUrl: "/SA.fasta",
    dbKey: "SA",
  },
  {
    id: "SS",
    short: "S. stutzeri",
    latin: "Stutzerimonas stutzeri",
    blurb: "Environmental denitrifier",
    annoUrl: "/Anno_SS.csv",
    interactionUrl: `${BLOB}/interaction_SS.csv`,
    contactsUrl: `${BLOB}/LR_chimeras_SS.bed`,
    fastaUrl: "/SS.fasta",
    dbKey: "SS",
  },
  {
    id: "MX",
    short: "M. xanthus",
    latin: "Myxococcus xanthus",
    blurb: "Social, multicellular δ-proteobacterium",
    annoUrl: "/Anno_MX.csv",
    interactionUrl: `${BLOB}/interaction_MX.csv`,
    contactsUrl: `${BLOB}/LR_chimera_MX.bed`,
    fastaUrl: "/MX.fasta",
    dbKey: "MX",
  },
];

export function speciesById(id: SpeciesId): SpeciesSource | undefined {
  return SPECIES.find((s) => s.id === id);
}

/** Build an external gene-database deep link for a given species + gene. */
export function dbLinkForGene(dbKey: DbKey | undefined, baseGeneName: string): string | null {
  if (!dbKey) return null;
  const g0 = baseGeneName;
  switch (dbKey) {
    case "EC":
      return `https://biocyc.org/ECOLI/substring-search?type=NIL&object=${encodeURIComponent(g0)}`;
    case "SS": {
      let id = g0;
      const m = /^PSJM300_(\d+)$/i.exec(g0);
      if (m && !/PSJM300_RS/i.test(g0)) id = `PSJM300_RS${m[1]}`;
      return `https://biocyc.org/gene?orgid=GCF_000279165&id=${encodeURIComponent(id)}`;
    }
    case "SA":
      return `https://aureowiki.med.uni-greifswald.de/${encodeURIComponent(g0)}`;
    case "BS":
      return `https://subtiwiki.uni-goettingen.de/v5/gene/${encodeURIComponent(g0)}`;
    case "MX":
      return `https://biocyc.org/gene?orgid=GCF_000012685&id=${encodeURIComponent(g0)}`;
    default:
      return null;
  }
}
