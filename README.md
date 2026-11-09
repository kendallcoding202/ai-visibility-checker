# AI Visibility Checker

Free tool: does ChatGPT recommend your brand? Asks ChatGPT (OpenAI + web search) 3 buyer-style questions in your category and reports mentions, rank, competitors and cited sources.

For weekly tracking across ChatGPT, Gemini & Perplexity, see the [AI Visibility Tracker](https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker).

Next.js on Vercel. Cost guards: per-IP daily limit, global daily cap, monthly budget ceiling, 24h result cache (Vercel Blob). Env: `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `HASH_SALT` (required in production and on Vercel preview), optional `PER_IP_DAILY`, `GLOBAL_DAILY`, `LAUNCH_DAYS` (comma list of UTC dates, default 2026-11-10..12), `LAUNCH_DAILY` (default 150), `MONTHLY_BUDGET_USD`, `LAUNCH_MONTH` + `LAUNCH_MONTHLY_BUDGET_USD` (default $20 for 2026-11). See `.env.example`.

`HASH_SALT` is mixed into the hashes for per-IP rate-limit keys and the 24h result cache. Set a long random value on the Vercel Production and Preview targets (it is already configured there). Do not commit it, and do not log it. Local `next dev` and `npm test` use a built-in dev-only fallback when it is unset. A production or preview runtime refuses the check with HTTP 503 instead of using that fallback. The salt is read on the request, not during `next build`, so a missing runtime secret does not fail the deploy. Changing `HASH_SALT` resets existing rate-limit and cache keys, so existing limits reset after that deploy.

Built by Kendall Sorenson.
