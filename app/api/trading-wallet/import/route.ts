import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptKey } from "@/lib/blockchain/keys";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export async function POST(req: Request) {
  const session = await auth(req);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { privateKey } = await req.json();
    if (!privateKey) return NextResponse.json({ message: "Key required" }, { status: 400 });

    let walletAddress = "";
    try {
      // Handle both hex and base58
      let secret;
      if (privateKey.length === 128) { // hex
        secret = Buffer.from(privateKey, 'hex');
      } else {
        secret = bs58.decode(privateKey);
      }
      const kp = Keypair.fromSecretKey(secret);
      walletAddress = kp.publicKey.toBase58();
    } catch (e) {
      return NextResponse.json({ message: "Invalid private key format" }, { status: 400 });
    }

    const encrypted = encryptKey(privateKey);

    const wallet = await prisma.tradingWallet.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        walletAddress,
        encryptedPrivateKey: encrypted,
      },
      update: {
        walletAddress,
        encryptedPrivateKey: encrypted,
      }
    });

    return NextResponse.json({
      address: wallet.walletAddress,
      createdAt: wallet.createdAt
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Import failed" }, { status: 500 });
  }
}
