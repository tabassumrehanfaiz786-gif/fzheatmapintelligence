<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules
- Order-book reconstruction lives in pure `src/lib/market/orderbook.ts` with unit tests — keeps sequence logic verifiable apart from the network.
- One shared live feed (`MarketFeedProvider` in root) serves all pages — avoids duplicate exchange connections.
- Unimplemented modules render `PlannedModule` with no data — never show placeholder numbers as real.
- Market data is read-only public exchange data; no trading endpoints or keys in the browser.
- Cross-venue spot/perp quotes use pure parsers in `src/lib/market/venues.ts` (unit-tested) with page-scoped connections on `/spot-perp` — level-1 data is only needed on that page, so it stays out of the shared depth feed.
- Liquidity event detection lives in pure, versioned `src/lib/market/analysis.ts` (unit-tested) and is shared by Migration, Integrity, Studio and Assistant — one deterministic rule set keeps results reproducible across pages.
- AI assistant calls run only in a server function (`src/lib/assistant.functions.ts`) and receive a computed event summary, not raw books — keeps keys server-side and prompts bounded.
- Spot/perp side-by-side heatmaps use pure helpers in `src/lib/market/dualbook.ts` (unit-tested), polling REST depth 1/s plus aggTrade streams, page-scoped — avoids a second sequenced diff book for futures.
- The overview liquidity terminal reuses the shared sequenced depth feed and a page-scoped public aggregate-trade stream — avoids duplicate depth connections.
- ETF issuer definitions and research chunking live in the pure ETF module; daily price comparisons are stored with analysis statistics — preserves reproducible reopening without a second price fetch.
