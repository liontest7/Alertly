import { Card } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"

export function StatCard({ label, value, subValue, trend, isPositive }: { label: string, value: string, subValue: string, trend?: string, isPositive?: boolean }) {
  return (
    <Card className="bg-zinc-950 border-zinc-900 p-8 rounded-[2rem] shadow-xl hover:border-zinc-800 transition-all">
      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-4">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
          <p className="text-xs text-zinc-500 mt-1 font-medium">{subValue}</p>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full border ${isPositive ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span className="text-[11px] font-bold">{trend}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
