# biotech-frontend

Next.js 15 frontend for the biotech stock screener. Wraps the [biotech-api](https://github.com/amirsarmad-cmd/biotech-api) with a dark terminal-aesthetic UI.

## Pages

- `/` — screener home: filterable, sortable table of all 70 biotech tickers with upcoming FDA catalysts
- `/stocks/[ticker]` — detail page: live price, all catalysts, NPV breakdown from LLM, news feed, analyst consensus, social sentiment
- `/watchlist` — (placeholder)

## Architecture

- **Next.js 15** with App Router, React 19, `output: 'standalone'` for Docker
- **TanStack Query** for server state — queries are keyed by ticker, TTLs tuned per endpoint
- **TypeScript** strict mode with typed API client in `lib/api.ts`
- **Tailwind** with custom dark palette, no component library
- **No Streamlit, no WebSockets** — pure HTTP/JSON

## Configuration

Single env var: `NEXT_PUBLIC_API_URL` (baked at build time).
Default: `https://biotech-api-production-7ec4.up.railway.app`

## Local dev

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

## Production build

```bash
npm run build
npm start
```

## Deploy (Railway)

Auto-deploys on push to main via the `Dockerfile`. Multi-stage build produces a small runtime image using Next.js's standalone mode.
