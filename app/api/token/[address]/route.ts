import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function tryFetch(url: string, timeoutMs = 5000) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: 10 },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function GET(_: Request, { params }: { params: { address: string } }) {
  const address = params.address;
  if (!address) {
    return NextResponse.json({ message: "Missing token address" }, { status: 400 });
  }

  const [dexData1, dexData2, pumpData] = await Promise.all([
    tryFetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`),
    tryFetch(`https://api.dexscreener.com/token-pairs/v1/solana/${address}`),
    address.toLowerCase().endsWith("pump")
      ? tryFetch(`https://frontend-api.pump.fun/coins/${address}`, 4000)
      : Promise.resolve(null),
  ]);

  const list1 = Array.isArray(dexData1?.pairs) ? dexData1.pairs : [];
  const list2 = Array.isArray(dexData2) ? dexData2 : Array.isArray(dexData2?.pairs) ? dexData2.pairs : [];
  const pairs = list1.length > 0 ? list1 : list2;

  const holders: number | null =
    typeof pumpData?.holder_count === "number" && pumpData.holder_count > 0
      ? Math.min(pumpData.holder_count, 1000)
      : null;

  if (pairs.length === 0) {
    return NextResponse.json({
      address,
      pairsCount: 0,
      pairs: [],
      bestPair: null,
      holders,
      message: "No live pair found for this token yet",
    });
  }

  const bestPair =
    pairs
      .filter((p: any) => String(p?.chainId || "").toLowerCase() === "solana")
      .sort((a: any, b: any) => Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0))[0] ||
    pairs[0] ||
    null;

  return NextResponse.json({
    address,
    bestPair,
    pairsCount: pairs.length,
    pairs,
    holders,
  });
}
