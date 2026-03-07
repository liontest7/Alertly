import { NextResponse } from "next/server";
import { getLiveAlerts } from "@/lib/blockchain/solana";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const alerts = await getLiveAlerts();
    return NextResponse.json(alerts);
  } catch (error) {
    console.error("Alerts API error", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
