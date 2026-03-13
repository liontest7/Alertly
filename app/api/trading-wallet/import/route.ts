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

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      await prisma.user.create({
        data: {
          id: session.user.id,
          walletAddress: session.user.walletAddress,
        },
      });
    }

    let walletAddress = "";
    let hexPrivateKey = "";
    try {
      let secret: Buffer;
      if (privateKey.length === 128 && /^[0-9a-fA-F]+$/.test(privateKey)) {
        secret = Buffer.from(privateKey, "hex");
        hexPrivateKey = privateKey;
      } else {
        const decoded = bs58.decode(privateKey);
        secret = Buffer.from(decoded);
        hexPrivateKey = secret.toString("hex");
      }
      const kp = Keypair.fromSecretKey(new Uint8Array(secret));
      walletAddress = kp.publicKey.toBase58();
    } catch (e) {
      return NextResponse.json({ message: "Invalid private key format" }, { status: 400 });
    }

    const encrypted = encryptKey(hexPrivateKey);
    if (!encrypted) return NextResponse.json({ message: "Failed to secure key" }, { status: 500 });

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
    return NextResponse.json({ message: error instanceof Error ? error.message : "Import failed" }, { status: 500 });
  }
}
