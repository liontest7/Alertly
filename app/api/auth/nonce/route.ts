export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAuthNonce } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { origin } = await req.json();
    const { message, nonce, nonceToken } = await createAuthNonce(origin || "localhost");
    return NextResponse.json({ message, nonce, nonceToken }, { status: 200 });
  } catch (error) {
    console.error("Nonce generation failed", error);
    return NextResponse.json({ message: "Failed to create nonce" }, { status: 500 });
  }
}
