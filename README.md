# AI Visibility Checker

Free tool: does ChatGPT recommend your brand? Asks ChatGPT (OpenAI + web search) 3 buyer-style questions in your category and reports mentions, rank, competitors and cited sources.

For weekly tracking across ChatGPT, Gemini & Perplexity, see the [AI Visibility Tracker](https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker).

Next.js on Vercel. Cost guards: per-IP daily limit, global daily cap, monthly budget ceiling, 24h result cache (Vercel Blob). Env: `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, optional `PER_IP_DAILY`, `GLOBAL_DAILY`, `LAUNCH_DAYS` (comma list of UTC dates, default 2026-11-10..12), `LAUNCH_DAILY` (default 150), `MONTHLY_BUDGET_USD`, `LAUNCH_MONTH` + `LAUNCH_MONTHLY_BUDGET_USD` (default $20 for 2026-11).

Built by Kendall Sorenson.
