import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function tryFetch(url: string) {
  try {
    const response = await fetch(url, { next: { revalidate: 10 } });
    if (!response.ok) {
      return null;
    }
    const json = await response.json();
    return json;
  } catch {
    return null;
  }
}

export async function GET(_: Request, { params }: { params: { address: string } }) {
  const address = params.address;
  if (!address) {
    return NextResponse.json({ message: "Missing token address" }, { status: 400 });
  }

  const candidates = [
    `https://api.dexscreener.com/latest/dex/tokens/${address}`,
    `https://api.dexscreener.com/token-pairs/v1/solana/${address}`,
  ];

  let pairs: any[] = [];
  for (const url of candidates) {
    const payload = await tryFetch(url);
    const list = Array.isArray(payload?.pairs) ? payload.pairs : Array.isArray(payload) ? payload : [];
    if (list.length > 0) {
      pairs = list;
      break;
    }
  }

  if (pairs.length === 0) {
    return NextResponse.json({
      address,
      pairsCount: 0,
      pairs: [],
      bestPair: null,
      message: "No live pair found for this token yet",
    });
  }

  const bestPair =
    pairs
      .filter((pair: any) => String(pair?.chainId || "").toLowerCase() === "solana")
      .sort((a: any, b: any) => Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0))[0] ||
    pairs[0] ||
    null;

  return NextResponse.json({
    address,
    bestPair,
    pairsCount: pairs.length,
    pairs,
  });
}
