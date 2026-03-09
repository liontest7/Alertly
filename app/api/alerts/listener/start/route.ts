import { NextResponse } from "next/server";
import { startAlertListener, getAlertListener } from "@/lib/alert-listener";
import { getListenerStatus } from "@/lib/listeners/blockchain-listener";

/**
 * Start the real-time blockchain listener
 * Monitors Solana DEX programs for token events with <2s latency
 */
export async function POST() {
  try {
    await startAlertListener();
    const status = getListenerStatus();
    
    return NextResponse.json(
      { 
        success: true, 
        message: "Blockchain listener started",
        status,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to start listener"
      },
      { status: 500 }
    );
  }
}

/**
 * Get listener status
 */
export async function GET() {
  try {
    const status = getListenerStatus();
    return NextResponse.json(
      { 
        status,
        description: "Real-time blockchain listener monitoring DEX programs",
        features: [
          "Monitors Raydium, Orca, Jupiter, Meteora DEX programs",
          "Detects new tokens, liquidity adds, volume spikes",
          "Target latency: <2 seconds",
          "Automatic risk scoring and filtering"
        ],
        endpoint: "/api/alerts/listener/start",
        method: "POST"
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get listener status" },
      { status: 500 }
    );
  }
}
