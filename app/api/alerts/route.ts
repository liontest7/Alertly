import { NextResponse } from "next/server";
import { getLiveAlerts } from "@/lib/blockchain/solana";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const alerts = await getLiveAlerts();
    
    // Ensure we return the standardized format used by the UI
    const formattedAlerts = alerts.map(a => ({
      ...a,
      type: a.type.replace('_', ' '), // Handle consistent naming
      trend: a.trend || (parseFloat(a.change) > 0 ? "up" : "down"),
      mc: a.mc || "Live",
      liquidity: a.liquidity || "Live",
      imageUrl: a.imageUrl || ""
    }));

    return NextResponse.json(formattedAlerts);
  } catch (error) {
    console.error("Alerts API error", error);
    // Return mock only if real fetch fails
    return NextResponse.json([
      {
        type: "VOLUME SPIKE",
        token: "SOL",
        name: "Solana",
        mc: "$10.2M",
        liquidity: "$500K",
        change: "+15.2%",
        trend: "up",
        holders: "1.2K",
        address: "So11111111111111111111111111111111111111112"
      }
    ]);
  }
}
