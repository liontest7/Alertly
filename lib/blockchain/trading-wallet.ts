import { Keypair } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { encryptKey } from "./keys";

export async function createTradingWallet(userId: string, walletAddress?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tradingWallet: true },
  });

  if (user?.tradingWallet) return user.tradingWallet;

  if (!user) {
    if (!walletAddress) {
      throw new Error("User record not found; please reconnect wallet and try again");
    }

    await prisma.user.create({
      data: {
        id: userId,
        walletAddress,
      },
    });
  }

  const keypair = Keypair.generate();
  const address = keypair.publicKey.toBase58();
  const privateKey = Buffer.from(keypair.secretKey).toString("hex");
  const encrypted = encryptKey(privateKey);

  if (!encrypted) {
    throw new Error("Could not secure private key");
  }

  const wallet = await prisma.tradingWallet.create({
    data: {
      userId,
      walletAddress: address,
      encryptedPrivateKey: encrypted,
    },
  });

  return wallet;
}
