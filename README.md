# TRIC-seq Interactome Explorer

**Live site:** https://www.tricseq.com

A Next.js (App Router) + Tailwind web app to explore RNA–RNA interactomes. Upload your data or try the simulated demo:

- **globalMAP** – RNA-centric global interaction map with clickable partners
- **csMAP** – Collapsed multi-RNA comparative target profiles + totals
- **pairMAP** – Multi-panel inter-RNA heatmaps from raw chimeras
- **foldMAP** – Intra-RNA contact maps (Raw/ICE) + long-range 1D profile with maxima

Header/UX niceties:
- Fast client-side CSV parsing (PapaParse)
- SVG export buttons
- Case-insensitive gene inputs

---

## Quick start (local)

Requirements: **Node 18+** and **npm**.

```bash
npm install
npm run dev
# open http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

> If you see an SWC warning, just run `npm run dev` once locally; Next.js will patch SWC deps automatically.

---

## Deploy on Vercel

1. **Import** this repo into Vercel and **Deploy** (defaults are fine).
2. **Add your domain** in *Project → Settings → Domains* (e.g., `tricseq.com`, `www.tricseq.com`).
3. **DNS** (typical setup):
   - Apex (`tricseq.com`) → **A** record → `76.76.21.21`
   - `www` → **CNAME** → `cname.vercel-dns.com`


---

## Data formats

### 1) Pairs table (`pairs_with_mc.csv`)

Minimum columns used by the app:
- **`ref`**, **`target`**, **`counts`**, **`odds_ratio`**
- Optional (used for coloring/metadata): `ref_type`, `target_type`, `totals`, `total_ref`, `score`, `adjusted_score`, `self_interaction_score`, `expected_count`, `p_value`, `start_ref`, `end_ref`, `start_target`, `end_target`, `p_value_FDR`

> The app de-duplicates partner rows per focal RNA by **summing counts** and taking **max `odds_ratio`** (prevents double-counting symmetrical pairs).

### 2) Annotations (`annotations.csv`)

Required columns:
- **`gene_name`**, **`start`**, **`end`**
- Optional: `feature_type`, `strand`, `chromosome`

### 3) Contacts for **pairMAP**/**foldMAP** (raw chimeras)

- **`.bed`**: 3+ columns; coordinates are taken from columns **2 & 3** (1-based recommended)
- **`.csv`**: 2 columns → `Coord1,Coord2` (integers)

---

## How to use each tool

### globalMAP
- Upload `pairs_with_mc.csv` + `annotations.csv` **or** click **Simulate** to use built-in data.
- Search an RNA, click partners to re-center.
- Filters: min counts, min genomic distance, cap for odds ratio, label threshold, exclude rRNA/tRNA/hkRNA.
- **Export** plot as SVG.

### csMAP
- Provide a comma/space-separated list of RNA names.
- Uses the same pairs/annotations inputs as globalMAP.
- Shows a **collapsed local-peak scatter** (smaller circles, low-count points drawn on top to avoid occlusion) and a **log-scaled totals bar chart**.
- Defaults tuned for clarity (counts cutoff = 10, no OR cutoff). **Export SVG** available.

### pairMAP
- Upload **annotations** + **contacts** (`.bed` or 2-col `.csv`).
- Enter primary (Y) RNA and a list of secondary (X) RNAs (case-insensitive).
- Sliders: **Flank Y/X**, **BIN size**, **VMAX**.  
- Y-axis orientation is flipped to match 5′→3′ conventions.  
- One panel per X-RNA, distinct palettes, ticks at `-flank / start / end / +flank`.  
- **Export SVG**.

### foldMAP
- Upload **annotations** + **contacts**.  
- Enter an RNA name and click **Load** (no heavy work while typing).
- Common **flank** slider applies to both **Raw** and **ICE** panels.
- Marks **start/end** and **flank** on both panels.  
- Also shows a **long-range (>5 kb) 1D profile** with smoothed maxima.  
- **Export SVG** for all graphics.

---

## Acknowledgements

Built by the **dRNA Lab** (SILS) — University of Amsterdam.  
© 2025 [*www.drna.nl*](https://www.drna.nl) — All rights reserved.
