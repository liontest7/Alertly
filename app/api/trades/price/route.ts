import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const addresses = url.searchParams.get("addresses");
    if (!addresses) return NextResponse.json({ prices: {} });

    const addrs = addresses.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 8);

    const prices: Record<string, { priceUsd: number; priceNative: number; symbol: string; name: string; volume24h?: number; liquidity?: number }> = {};

    await Promise.allSettled(
      addrs.map(async (addr) => {
        try {
          const res = await fetch(
            `https://api.dexscreener.com/tokens/v1/solana/${addr}`,
            { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) }
          );
          if (!res.ok) return;
          const data = await res.json();
          const pair = Array.isArray(data) ? data[0] : (data?.pairs?.[0] ?? null);
          if (!pair) return;
          prices[addr] = {
            priceUsd: parseFloat(pair.priceUsd ?? "0"),
            priceNative: parseFloat(pair.priceNative ?? "0"),
            symbol: pair.baseToken?.symbol ?? "",
            name: pair.baseToken?.name ?? "",
            volume24h: pair.volume?.h24 ?? undefined,
            liquidity: pair.liquidity?.usd ?? undefined,
          };
        } catch {}
      })
    );

    return NextResponse.json({ prices });
  } catch {
    return NextResponse.json({ prices: {} });
  }
}
