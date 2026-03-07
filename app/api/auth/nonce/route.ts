export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAuthNonce } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { origin } = await req.json();
    // Use the actual request origin or a safe fallback
    const domain = req.headers.get("host") || origin || "alertly.ai";
    const { message, nonce, nonceToken } = await createAuthNonce(domain);
    return new NextResponse(JSON.stringify({ message, nonce, nonceToken }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Nonce generation failed", error);
    return new NextResponse(JSON.stringify({ message: "Failed to create nonce" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
