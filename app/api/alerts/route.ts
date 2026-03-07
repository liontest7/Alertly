import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const alerts = [
    {
      type: "VOLUME_SPIKE",
      token: "SOLANA",
      name: "Solana",
      mc: "$10.2M",
      liquidity: "$500K",
      change: "+15.2%",
      trend: "up",
      holders: "1.2K",
      address: "So11111111111111111111111111111111111111112"
    },
    {
      type: "DEX_BOOST",
      token: "JUP",
      name: "Jupiter",
      mc: "$5.4M",
      liquidity: "$250K",
      change: "+8.4%",
      trend: "up",
      holders: "850",
      address: "JUPyiZJpEGkQ7eZ1byKtfyH5Y64Mno8Uq8VEnyTzXmr"
    },
    {
      type: "WHALE_ALERT",
      token: "PYTH",
      name: "Pyth Network",
      mc: "$2.1M",
      liquidity: "$120K",
      change: "+4.1%",
      trend: "up",
      holders: "420",
      address: "HZ1JEPncv8vJvTzu9197p4A1pS2Xf6fM94v69n8N1vN"
    },
    {
      type: "DEX_LISTING",
      token: "RENDER",
      name: "Render",
      mc: "$1.5M",
      liquidity: "$80K",
      change: "+2.5%",
      trend: "up",
      holders: "310",
      address: "rndrizKT3MK1bimBgBbeAyMv9hAmeK9yR2qL2g8rT9u"
    }
  ];

  return NextResponse.json(alerts);
}
