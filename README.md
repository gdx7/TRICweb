# TRIC-seq Interactome Explorer (Next.js + Tailwind)
Upload `pairs_with_mc.csv` and `annotations.csv`, search an RNA, view a global interaction map, click to re-center.

## Run locally
npm install
npm run dev
# open http://localhost:3000

## Deploy on Vercel
- Import this repo → Deploy (defaults ok)
- Add your domain in Project → Settings → Domains

## CSV headers
**Pairs:** ref,target,counts,totals,total_ref,score,adjusted_score,ref_type,target_type,self_interaction_score,expected_count,p_value,odds_ratio,start_ref,end_ref,start_target,end_target,p_value_FDR  
**Annotations:** gene_name,start,end,feature_type,strand,chromosome
