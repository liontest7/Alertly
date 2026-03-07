"use client";

import Link from "next/link";

export default function AuthPage() {
  return (
    <div className="min-h-[60dvh] bg-black text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Authentication Required</h1>
        <p className="text-zinc-400">Please connect your Solana wallet to continue.</p>
        <Link href="/connect-wallet" className="text-[#5100fd] font-bold hover:underline">
          Go to Connect Wallet
        </Link>
      </div>
    </div>
  );
}
