import { Keypair } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { encryptKey } from "./keys";

export async function createTradingWallet(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tradingWallet: true }
  });

  if (user?.tradingWallet) return user.tradingWallet;

  const keypair = Keypair.generate();
  const address = keypair.publicKey.toBase58();
  const privateKey = Buffer.from(keypair.secretKey).toString('hex');
  const encrypted = encryptKey(privateKey);

  const wallet = await prisma.tradingWallet.create({
    data: {
      userId,
      walletAddress: address,
      encryptedPrivateKey: encrypted,
    }
  });

  return wallet;
}
