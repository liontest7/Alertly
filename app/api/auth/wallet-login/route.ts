import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAuthToken, getVipStatus, setAuthCookie, verifyWalletSignature } from "@/lib/auth";
import { createTradingWallet } from "@/lib/blockchain/trading-wallet";

export async function POST(req: Request) {
  try {
    const { wallet_address, signature, message, nonce_token } = await req.json();

    if (!wallet_address || !signature || !message || !nonce_token) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const verification = await verifyWalletSignature({
      walletAddress: String(wallet_address),
      signature: String(signature),
      message: String(message),
      nonceToken: String(nonce_token),
    });

    if (!verification.valid) {
      return NextResponse.json({ message: verification.reason }, { status: 401 });
    }

    const walletAddress = String(wallet_address);
    const vipStatus = await getVipStatus(walletAddress);

    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {
        vipLevel: vipStatus ? 1 : 0,
        lastLogin: new Date(),
      },
      create: {
        walletAddress,
        vipLevel: vipStatus ? 1 : 0,
        lastLogin: new Date(),
      },
    });

    // Ensure session is fully committed if using a cache or similar
    // But mainly just ensure the user object is what we expect
    
    try {
      await createTradingWallet(user.id);
    } catch (e) {
      console.error("Trading wallet error:", e);
    }

    const authToken = await buildAuthToken({
      id: user.id,
      walletAddress: user.walletAddress,
      vipStatus,
    });

    const loginData = {
      authenticated: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        vipStatus,
      },
    };

    const response = new NextResponse(JSON.stringify(loginData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    setAuthCookie(response, authToken);

    return response;
  } catch (error) {
    console.error("Login route error:", error);
    return new NextResponse(JSON.stringify({ message: "Internal server error" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
