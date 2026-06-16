"use client";

// lib/explore/store.tsx
// The single source of truth for the unified Explorer. One provider holds the
// loaded dataset (annotations + interactions + chimera contacts), the current
// focal RNA, the partner selection and all shared filters — so every lens reads
// from the same context and updates the instant the focal RNA changes.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import type { Annotation, FeatureType, Pair } from "@/lib/shared";
import { parseAnnoCSV, parsePairsCSV, cf } from "@/lib/shared";
import { SPECIES, SpeciesId, speciesById, dbLinkForGene, DbKey } from "./registry";
import { simulateExploreData } from "./simulate";
import {
  buildGeneIndex,
  buildPartners,
  buildTotalsByGene,
  totalRefByGene,
  PartnerRow,
} from "./compute";

export type SortKey = "odds_ratio" | "counts" | "fdr" | "distance" | "start";

type LoadStatus = "idle" | "loading" | "loaded" | "error";

type ExplorerState = {
  // identity of the loaded dataset
  speciesId: SpeciesId | null; // null = simulated demo
  sourceLabel: string;
  dbKey: DbKey | undefined;
  dataStatus: LoadStatus;
  contactsStatus: LoadStatus;
  dataError: string | null;

  // data
  annotations: Annotation[];
  pairs: Pair[];
  contacts: Array<[number, number]>;
  genomeSeq: string | null; // in-memory genome for the demo (predictor sequences)
  fastaUrl: string | null;  // species genome FASTA url (fetched on demand)

  // selection / focus
  focal: string;
  activePartner: string | null; // partner whose pair map is shown
  pinned: string[]; // compare set (ordered)
  highlight: Set<string>;

  // filters
  minCounts: number;
  yCap: number;
  labelThreshold: number;
  excludeTypes: FeatureType[];
  sizeScale: number;
  sortKey: SortKey;
  sortDesc: boolean;

  // derived
  geneIndex: Record<string, Annotation>;
  annoByCF: Map<string, Annotation>;
  allGenes: string[];
  partners: PartnerRow[];
  sortedPartners: PartnerRow[];
  effectiveActivePartner: PartnerRow | null;
  focalAnn?: Annotation;
  focalTotal: number;
  genomeStart: number;
  genomeEnd: number;
  genomeLen: number;

  // actions
  setFocal: (g: string) => void;
  setActivePartner: (g: string | null) => void;
  togglePin: (g: string) => void;
  clearPins: () => void;
  setHighlight: (s: Set<string>) => void;
  setMinCounts: (n: number) => void;
  setYCap: (n: number) => void;
  setLabelThreshold: (n: number) => void;
  toggleExclude: (types: FeatureType[]) => void;
  setSizeScale: (n: number) => void;
  setSort: (k: SortKey) => void;
  loadSpecies: (id: SpeciesId) => Promise<void>;
  loadDemo: () => void;
  ensureContacts: () => Promise<void>;
  pickRandom: () => void;
  dbLink: (gene: string) => string | null;
  onAnnoFile: (file: File) => void;
  onPairsFile: (file: File) => void;
  onContactsFile: (file: File) => Promise<void>;
};

const Ctx = createContext<ExplorerState | null>(null);

export function useExplorer(): ExplorerState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useExplorer must be used inside <ExplorerProvider>");
  return v;
}

// ---- fast chimera (.bed/.csv) parsers ----
function parseContactsFast(txt: string): Array<[number, number]> {
  const rows: Array<[number, number]> = [];
  let pos = 0;
  while (pos < txt.length) {
    let nl = txt.indexOf("\n", pos);
    if (nl === -1) nl = txt.length;
    if (nl - pos > 4) {
      let end = nl;
      if (txt[end - 1] === "\r") end--;
      const line = txt.slice(pos, end);
      const c0 = line[0];
      if (c0 !== "t" && c0 !== "b" && c0 !== "T" && c0 !== "B") {
        const parts = line.split(/[\s,]+/);
        if (parts.length >= 3) {
          const v1 = Number(parts[1]), v2 = Number(parts[2]);
          if (!isNaN(v1) && !isNaN(v2)) rows.push([v1, v2]);
        } else if (parts.length >= 2) {
          const v1 = Number(parts[0]), v2 = Number(parts[1]);
          if (!isNaN(v1) && !isNaN(v2)) rows.push([v1, v2]);
        }
      }
    }
    pos = nl + 1;
  }
  return rows;
}

async function streamParseContacts(f: File): Promise<Array<[number, number]>> {
  const rows: Array<[number, number]> = [];
  const reader = f.stream().getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const handle = (line: string) => {
    if (line.length <= 4) return;
    const c0 = line[0];
    if (c0 === "t" || c0 === "b" || c0 === "T" || c0 === "B") return;
    const parts = line.split(/[\s,]+/);
    if (parts.length >= 3) {
      const v1 = Number(parts[1]), v2 = Number(parts[2]);
      if (!isNaN(v1) && !isNaN(v2)) rows.push([v1, v2]);
    } else if (parts.length >= 2) {
      const v1 = Number(parts[0]), v2 = Number(parts[1]);
      if (!isNaN(v1) && !isNaN(v2)) rows.push([v1, v2]);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      handle(buffer.slice(0, nl).trim());
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf("\n");
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) handle(buffer.trim());
  return rows;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

function chooseDefaultFocal(annotations: Annotation[], pairs: Pair[]): string {
  if (!annotations.length) return "";
  const totals = buildTotalsByGene(pairs);
  const annNames = new Set(annotations.map((a) => a.gene_name));
  let best = "";
  let bestScore = -1;
  // prefer the most-connected sRNA, then most-connected anything
  for (const a of annotations) {
    if (a.feature_type !== "sRNA" && a.feature_type !== "ncRNA") continue;
    const t = totals.get(a.gene_name) ?? 0;
    if (t > bestScore) { bestScore = t; best = a.gene_name; }
  }
  if (best) return best;
  totals.forEach((t, g) => {
    if (annNames.has(g) && t > bestScore) { bestScore = t; best = g; }
  });
  return best || annotations[0].gene_name;
}

export function ExplorerProvider({ children }: { children: React.ReactNode }) {
  const demo = useMemo(() => simulateExploreData(7), []);

  const [speciesId, setSpeciesId] = useState<SpeciesId | null>(null);
  const [sourceLabel, setSourceLabel] = useState("Demo · simulated");
  const [dbKey, setDbKey] = useState<DbKey | undefined>(undefined);
  const [dataStatus, setDataStatus] = useState<LoadStatus>("loaded");
  const [contactsStatus, setContactsStatus] = useState<LoadStatus>("loaded");
  const [dataError, setDataError] = useState<string | null>(null);

  const [annotations, setAnnotations] = useState<Annotation[]>(demo.annotations);
  const [pairs, setPairs] = useState<Pair[]>(demo.pairs);
  const [contacts, setContacts] = useState<Array<[number, number]>>(demo.contacts);
  const [genomeSeq, setGenomeSeq] = useState<string | null>(demo.genomeSeq);
  const [fastaUrl, setFastaUrl] = useState<string | null>(null);

  const [focal, setFocalState] = useState<string>("srna1");
  const [activePartner, setActivePartnerState] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());

  const [minCounts, setMinCounts] = useState(5);
  const [yCap, setYCap] = useState(5000);
  const [labelThreshold, setLabelThreshold] = useState(50);
  const [excludeTypes, setExcludeTypes] = useState<FeatureType[]>(["tRNA"]);
  const [sizeScale, setSizeScale] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("odds_ratio");
  const [sortDesc, setSortDesc] = useState(true);

  // the in-flight request token guards against races between species switches
  const loadToken = useRef(0);

  const setFocal = useCallback((g: string) => {
    setFocalState(g);
    setActivePartnerState(null);
  }, []);

  const setActivePartner = useCallback((g: string | null) => setActivePartnerState(g), []);

  const togglePin = useCallback((g: string) => {
    setPinned((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }, []);
  const clearPins = useCallback(() => setPinned([]), []);

  const toggleExclude = useCallback((types: FeatureType[]) => {
    setExcludeTypes((prev) => {
      const active = types.every((t) => prev.includes(t));
      if (active) return prev.filter((t) => !types.includes(t));
      const s = new Set(prev);
      types.forEach((t) => s.add(t));
      return Array.from(s);
    });
  }, []);

  const setSort = useCallback((k: SortKey) => {
    setSortKey((prevKey) => {
      setSortDesc((prevDesc) => (prevKey === k ? !prevDesc : k === "distance" || k === "start" ? false : true));
      return k;
    });
  }, []);

  // ---- derived ----
  const geneIndex = useMemo(() => buildGeneIndex(annotations), [annotations]);
  const annoByCF = useMemo(() => {
    const m = new Map<string, Annotation>();
    for (const a of annotations) m.set(cf(a.gene_name), a);
    return m;
  }, [annotations]);
  const allGenes = useMemo(() => annotations.map((a) => a.gene_name), [annotations]);

  const partners = useMemo(
    () => buildPartners(pairs, focal, geneIndex, { minCounts, yCap, excludeTypes }),
    [pairs, focal, geneIndex, minCounts, yCap, excludeTypes]
  );

  const sortedPartners = useMemo(() => {
    const s = [...partners];
    s.sort((a, b) => {
      let va: number, vb: number;
      if (sortKey === "odds_ratio") { va = a.rawY; vb = b.rawY; }
      else if (sortKey === "counts") { va = a.counts; vb = b.counts; }
      else if (sortKey === "fdr") { va = a.fdr != null ? -a.fdr : -999; vb = b.fdr != null ? -b.fdr : -999; }
      else if (sortKey === "distance") { va = a.distance; vb = b.distance; }
      else { va = a.start; vb = b.start; }
      return sortDesc ? vb - va : va - vb;
    });
    return s;
  }, [partners, sortKey, sortDesc]);

  const effectiveActivePartner = useMemo<PartnerRow | null>(() => {
    if (activePartner) {
      const found = partners.find((p) => p.partner === activePartner);
      if (found) return found;
    }
    // default to the strongest partner so the pair lens is never empty
    let best: PartnerRow | null = null;
    for (const p of partners) if (!best || p.rawY > best.rawY) best = p;
    return best;
  }, [activePartner, partners]);

  const totalRef = useMemo(() => totalRefByGene(pairs), [pairs]);
  const totalsByGene = useMemo(() => buildTotalsByGene(pairs), [pairs]);
  const focalAnn = geneIndex[focal];
  const focalTotal = totalRef.get(focal) ?? totalsByGene.get(focal) ?? 0;

  const genomeStart = useMemo(() => (annotations.length ? Math.min(...annotations.map((a) => a.start)) : 0), [annotations]);
  const genomeEnd = useMemo(() => (annotations.length ? Math.max(...annotations.map((a) => a.end)) : 1), [annotations]);
  const genomeLen = Math.max(1, genomeEnd - genomeStart);

  const dbLink = useCallback(
    (gene: string) => dbLinkForGene(dbKey, gene.replace(/^5'|^3'/, "").split(".")[0]),
    [dbKey]
  );

  const pickRandom = useCallback(() => {
    const candidates = allGenes.filter((g) => (totalsByGene.get(g) ?? 0) >= 150);
    const pool = candidates.length ? candidates : allGenes;
    if (!pool.length) return;
    setFocal(pool[Math.floor(Math.random() * pool.length)]);
  }, [allGenes, totalsByGene, setFocal]);

  const loadDemo = useCallback(() => {
    loadToken.current++;
    setSpeciesId(null);
    setSourceLabel("Demo · simulated");
    setDbKey(undefined);
    setAnnotations(demo.annotations);
    setPairs(demo.pairs);
    setContacts(demo.contacts);
    setGenomeSeq(demo.genomeSeq);
    setFastaUrl(null);
    setDataStatus("loaded");
    setContactsStatus("loaded");
    setDataError(null);
    setPinned([]);
    setFocal("srna1");
  }, [demo, setFocal]);

  const loadSpecies = useCallback(
    async (id: SpeciesId) => {
      const src = speciesById(id);
      if (!src) return;
      const token = ++loadToken.current;
      setDataStatus("loading");
      setContactsStatus("idle");
      setDataError(null);
      setSpeciesId(id);
      setSourceLabel(src.short);
      setDbKey(src.dbKey);
      setGenomeSeq(null);
      setFastaUrl(src.fastaUrl);
      try {
        const [annoText, pairsText] = await Promise.all([fetchText(src.annoUrl), fetchText(src.interactionUrl)]);
        if (token !== loadToken.current) return;
        const ann = parseAnnoCSV(annoText);
        const pr = parsePairsCSV(pairsText);
        setAnnotations(ann);
        setPairs(pr);
        setContacts([]);
        setPinned([]);
        setDataStatus("loaded");
        setFocal(chooseDefaultFocal(ann, pr));
      } catch (e: any) {
        if (token !== loadToken.current) return;
        setDataError(e?.message || "Failed to load dataset");
        setDataStatus("error");
      }
    },
    [setFocal]
  );

  const ensureContacts = useCallback(async () => {
    if (speciesId == null) return; // demo already has contacts
    if (contactsStatus === "loaded" || contactsStatus === "loading") return;
    const src = speciesById(speciesId);
    if (!src) return;
    const token = loadToken.current;
    setContactsStatus("loading");
    try {
      const txt = await fetchText(src.contactsUrl);
      if (token !== loadToken.current) return;
      setContacts(parseContactsFast(txt));
      setContactsStatus("loaded");
    } catch (e: any) {
      if (token !== loadToken.current) return;
      setContactsStatus("error");
    }
  }, [speciesId, contactsStatus]);

  const onAnnoFile = useCallback(
    (file: File) => {
      loadToken.current++;
      setSpeciesId(null);
      setSourceLabel(file.name);
      setDbKey(undefined);
      setGenomeSeq(null);
      setFastaUrl(null);
      Papa.parse<any>(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        worker: true,
        complete: (res) => {
          const rows = (res.data as any[])
            .filter((r) => r.gene_name && r.start != null && r.end != null)
            .map((r) => ({
              gene_name: String(r.gene_name).trim(),
              start: Number(r.start),
              end: Number(r.end),
              feature_type: r.feature_type,
              strand: r.strand,
              chromosome: r.chromosome,
            })) as Annotation[];
          setAnnotations(rows);
          if (rows.length) setFocal(rows[0].gene_name);
        },
      });
    },
    [setFocal]
  );

  const onPairsFile = useCallback((file: File) => {
    loadToken.current++;
    setSpeciesId(null);
    setSourceLabel((s) => (s === "Demo · simulated" ? file.name : s));
    Papa.parse<any>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      worker: true,
      complete: (res) => {
        const rows = (res.data as any[])
          .filter((r) => r.ref && r.target)
          .map((r) => {
            const rawFdr = r.p_value_FDR ?? r.fdr ?? r.FDR ?? r.fdr_adj ?? r.p_adj;
            const fdrNum = rawFdr != null && rawFdr !== "" ? Number(rawFdr) : undefined;
            return {
              ref: String(r.ref).trim(),
              target: String(r.target).trim(),
              counts: r.counts != null ? Number(r.counts) : 0,
              odds_ratio: r.odds_ratio != null ? Number(r.odds_ratio) : 0,
              fdr: Number.isFinite(fdrNum as number) ? (fdrNum as number) : undefined,
              totals: r.totals != null ? Number(r.totals) : undefined,
              total_ref: r.total_ref != null ? Number(r.total_ref) : undefined,
              ref_type: r.ref_type,
              target_type: r.target_type,
            } as Pair;
          });
        setPairs(rows);
      },
    });
  }, []);

  const onContactsFile = useCallback(async (file: File) => {
    loadToken.current++;
    setContactsStatus("loading");
    try {
      const rows = await streamParseContacts(file);
      setContacts(rows);
      setContactsStatus("loaded");
    } catch {
      setContactsStatus("error");
    }
  }, []);

  const value: ExplorerState = {
    speciesId,
    sourceLabel,
    dbKey,
    dataStatus,
    contactsStatus,
    dataError,
    annotations,
    pairs,
    contacts,
    genomeSeq,
    fastaUrl,
    focal,
    activePartner,
    pinned,
    highlight,
    minCounts,
    yCap,
    labelThreshold,
    excludeTypes,
    sizeScale,
    sortKey,
    sortDesc,
    geneIndex,
    annoByCF,
    allGenes,
    partners,
    sortedPartners,
    effectiveActivePartner,
    focalAnn,
    focalTotal,
    genomeStart,
    genomeEnd,
    genomeLen,
    setFocal,
    setActivePartner,
    togglePin,
    clearPins,
    setHighlight,
    setMinCounts,
    setYCap,
    setLabelThreshold,
    toggleExclude,
    setSizeScale,
    setSort,
    loadSpecies,
    loadDemo,
    ensureContacts,
    pickRandom,
    dbLink,
    onAnnoFile,
    onPairsFile,
    onContactsFile,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { SPECIES };
