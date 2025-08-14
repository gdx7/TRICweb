// /lib/presets.ts
export const PRESETS = {
  // Shown in GlobalMAP + csMAP “Interaction analysis CSV” dropdown
  interactions: [
    { label: "Interaction — EC", url: "https://6xaweu7axahancgd.public.blob.vercel-storage.com/interaction_EC.csv" },
    { label: "Interaction — SA", url: "https://6xaweu7axahancgd.public.blob.vercel-storage.com/interaction_SA.csv" },
    { label: "Interaction — SS", url: "https://6xaweu7axahancgd.public.blob.vercel-storage.com/interaction_SS.csv" },
    { label: "Interaction — MX", url: "https://6xaweu7axahancgd.public.blob.vercel-storage.com/interaction_MX.csv" },
  ],

  // Shown in pairMAP + foldMAP “Chimeras (.bed/.csv)” dropdown
  chimeras: [
    { label: "Chimeras — EC (long-range)", url: "https://6xaweu7axahancgd.public.blob.vercel-storage.com/LR_chimera_EC.bed" },
    { label: "Chimeras — SA (long-range)", url: "https://6xaweu7axahancgd.public.blob.vercel-storage.com/LR_chimera_SA.bed" },
  ],
};
