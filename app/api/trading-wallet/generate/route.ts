import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTradingWallet } from "@/lib/blockchain/trading-wallet";
import { Keypair } from "@solana/web3.js";

export async function POST(req: Request) {
  try {
    const session = await auth(req);
    
    if (session?.user?.id) {
      const wallet = await createTradingWallet(session.user.id, session.user.walletAddress);
      return NextResponse.json({
        address: wallet.walletAddress,
        privateKey: wallet.privateKey,
        createdAt: wallet.createdAt
      }, { status: 200 });
    } else {
      const keypair = Keypair.generate();
      return NextResponse.json({
        address: keypair.publicKey.toBase58(),
        privateKey: Buffer.from(keypair.secretKey).toString('base64'),
        createdAt: new Date().toISOString()
      }, { status: 200 });
    }
  } catch (error) {
    console.error("Failed to generate trading wallet:", error);
    const message = error instanceof Error ? error.message : "Failed to generate wallet";
    return NextResponse.json({ message }, { status: 500 });
  }
}
