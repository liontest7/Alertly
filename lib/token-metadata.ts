interface TokenMeta {
  name: string;
  symbol: string;
  imageUrl: string | null;
  mc: string;
  liquidity: string;
  priceUsd: string | null;
  change24h: string;
  volume24h: string;
  pairAddress: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

interface CacheEntry {
  data: TokenMeta;
  fetchedAt: number;
}

const metaCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 120_000;
const BATCH_SIZE = 30;
const BATCH_INTERVAL_MS = 1500;
const RATE_LIMIT_RETRY_MS = 10_000;
let rateLimitedUntil = 0;

type Resolver = (v: TokenMeta | null) => void;
const pendingQueue = new Map<string, Resolver[]>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function formatUsd(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return "N/A";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function parsePair(pair: any): TokenMeta {
  const base = pair?.baseToken || {};
  const info = pair?.info || {};
  const socials: any[] = info?.socials || [];
  const links: any[] = info?.links || [];
  const allLinks = [...socials, ...links];

  const website = allLinks.find((s: any) => s.type === "website" || s.label?.toLowerCase() === "website")?.url || null;
  const twitter = allLinks.find((s: any) => s.type === "twitter" || s.label?.toLowerCase() === "twitter")?.url || null;
  const telegram = allLinks.find((s: any) => s.type === "telegram" || s.label?.toLowerCase() === "telegram")?.url || null;

  const mc = pair?.fdv ?? pair?.marketCap ?? null;
  const liq = pair?.liquidity?.usd ?? null;
  const vol24h = pair?.volume?.h24 ?? null;
  const change24h = pair?.priceChange?.h24 ?? 0;

  const fallbackImageUrl = base.address
    ? `https://dd.dexscreener.com/ds-data/tokens/solana/${base.address}.png`
    : null;

  return {
    name: base.name || "Unknown Token",
    symbol: base.symbol || "???",
    imageUrl: info?.imageUrl || fallbackImageUrl,
    mc: formatUsd(mc),
    liquidity: formatUsd(liq),
    priceUsd: pair?.priceUsd ? `$${Number(pair.priceUsd).toPrecision(4)}` : null,
    change24h: `${change24h >= 0 ? "+" : ""}${Number(change24h).toFixed(1)}%`,
    volume24h: formatUsd(vol24h),
    pairAddress: pair?.pairAddress || null,
    website,
    twitter,
    telegram,
  };
}

async function fetchJupiterMeta(address: string): Promise<Partial<TokenMeta> | null> {
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${address}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const token = await res.json();
    if (!token || !token.address) return null;
    return {
      name: token.name || "Unknown Token",
      symbol: token.symbol || "???",
      imageUrl: token.logoURI || null,
    };
  } catch {
    return null;
  }
}

async function fetchBatch(addresses: string[]): Promise<Map<string, TokenMeta>> {
  const results = new Map<string, TokenMeta>();
  if (addresses.length === 0) return results;

  if (Date.now() < rateLimitedUntil) return results;

  try {
    const url = `https://api.dexscreener.com/tokens/v1/solana/${addresses.join(",")}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 429 || res.status === 1015) {
      rateLimitedUntil = Date.now() + RATE_LIMIT_RETRY_MS;
      return results;
    }

    if (!res.ok) return results;

    const text = await res.text();
    if (text.startsWith("error")) {
      rateLimitedUntil = Date.now() + RATE_LIMIT_RETRY_MS;
      return results;
    }

    const json = JSON.parse(text);
    const pairs: any[] = Array.isArray(json) ? json : (json?.pairs || json?.data || []);

    for (const pair of pairs) {
      const tokenAddr = pair?.baseToken?.address;
      if (tokenAddr) {
        const meta = parsePair(pair);
        results.set(tokenAddr, meta);
      }
    }
  } catch {
  }

  const missing = addresses.filter((a) => !results.has(a));
  if (missing.length > 0) {
    await Promise.allSettled(
      missing.slice(0, 5).map(async (addr) => {
        const jupMeta = await fetchJupiterMeta(addr);
        if (jupMeta) {
          results.set(addr, {
            name: jupMeta.name || "Unknown Token",
            symbol: jupMeta.symbol || "???",
            imageUrl: jupMeta.imageUrl || null,
            mc: "N/A",
            liquidity: "N/A",
            priceUsd: null,
            change24h: "0.0%",
            volume24h: "N/A",
            pairAddress: null,
            website: null,
            twitter: null,
            telegram: null,
          });
        }
      }),
    );
  }

  return results;
}

function scheduleBatch(delay = BATCH_INTERVAL_MS) {
  if (batchTimer) return;
  batchTimer = setTimeout(async () => {
    batchTimer = null;

    if (Date.now() < rateLimitedUntil) {
      scheduleBatch(rateLimitedUntil - Date.now() + 500);
      return;
    }

    const entries = [...pendingQueue.entries()].slice(0, BATCH_SIZE);
    if (entries.length === 0) return;

    const addresses = entries.map(([addr]) => addr);
    for (const addr of addresses) pendingQueue.delete(addr);

    const results = await fetchBatch(addresses);

    const rateLimited = results.size === 0 && Date.now() < rateLimitedUntil;

    for (const [addr, resolvers] of entries) {
      const meta = results.get(addr) || null;
      if (meta) {
        metaCache.set(addr, { data: meta, fetchedAt: Date.now() });
        for (const resolve of resolvers) resolve(meta);
      } else if (rateLimited) {
        const existing = pendingQueue.get(addr) || [];
        pendingQueue.set(addr, [...existing, ...resolvers]);
      } else {
        for (const resolve of resolvers) resolve(null);
      }
    }

    if (pendingQueue.size > 0) {
      scheduleBatch(rateLimited ? Math.max(RATE_LIMIT_RETRY_MS, rateLimitedUntil - Date.now() + 500) : BATCH_INTERVAL_MS);
    }
  }, delay);
}

export async function getTokenMeta(tokenAddress: string): Promise<TokenMeta | null> {
  const cached = metaCache.get(tokenAddress);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  return new Promise<TokenMeta | null>((resolve) => {
    const resolvers = pendingQueue.get(tokenAddress) || [];
    resolvers.push(resolve);
    pendingQueue.set(tokenAddress, resolvers);
    scheduleBatch();
  });
}

export function prefetchTokenMeta(addresses: string[]) {
  const uncached = addresses.filter((addr) => {
    const cached = metaCache.get(addr);
    return !cached || Date.now() - cached.fetchedAt >= CACHE_TTL_MS;
  });

  for (const addr of uncached) {
    if (!pendingQueue.has(addr)) {
      pendingQueue.set(addr, []);
    }
  }

  if (pendingQueue.size > 0) scheduleBatch();
}
