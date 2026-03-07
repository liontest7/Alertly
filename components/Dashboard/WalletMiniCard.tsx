import { Card } from "@/components/ui/card"
import { Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"

export function WalletMiniCard({ user }: { user: any }) {
  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem]">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
        <Wallet className="w-3.5 h-3.5" /> Wallet
      </h3>
      <div className="space-y-4">
        <div>
          <p className="text-2xl font-bold text-white">Trading Wallet</p>
          <p className="text-xs text-zinc-400 truncate">{user?.wallet_address || user?.walletAddress || "Connect to see details"}</p>
        </div>
        <div className="flex gap-2">
          {!user ? (
            <div className="flex-1 [&_.wallet-adapter-button]:!w-full [&_.wallet-adapter-button]:!bg-[#5100fd] [&_.wallet-adapter-button]:!text-white [&_.wallet-adapter-button]:!rounded-xl [&_.wallet-adapter-button]:!h-10 [&_.wallet-adapter-button]:!text-[10px] [&_.wallet-adapter-button]:!font-bold">
              <WalletMultiButton />
            </div>
          ) : (
            <>
              <Button variant="outline" className="flex-1 rounded-xl border-zinc-800 text-[10px] font-bold h-10 text-white hover:bg-zinc-900">DEPOSIT</Button>
              <Button className="flex-1 bg-[#5100fd] hover:bg-[#6610ff] rounded-xl text-[10px] font-bold h-10 text-white">WITHDRAW</Button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
