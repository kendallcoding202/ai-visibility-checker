#!/usr/bin/env bash
# Run AFTER merging seo-compare-pages to main and the production deploy is live.
set -euo pipefail
HOST=aivisibilitychecker.app
KEY=dd72dedcf3aa0cd7e90258098fee68b4
curl -fsS "https://$HOST/$KEY.txt" | grep -q "$KEY" || { echo "Key file not live yet"; exit 1; }
curl -sS -w '\nHTTP %{http_code}\n' -X POST https://api.indexnow.org/indexnow \
  -H 'Content-Type: application/json; charset=utf-8' \
  -d "{\"host\":\"$HOST\",\"key\":\"$KEY\",\"keyLocation\":\"https://$HOST/$KEY.txt\",\"urlList\":[\"https://$HOST/\",\"https://$HOST/best-ai-visibility-tools\",\"https://$HOST/how-to-check-chatgpt-brand-mentions\",\"https://$HOST/why-chatgpt-recommends-competitors\",\"https://$HOST/which-sites-ai-cites-in-your-niche\",\"https://$HOST/llms.txt\",\"https://$HOST/sitemap.xml\"]}"
# 200 or 202 = accepted
