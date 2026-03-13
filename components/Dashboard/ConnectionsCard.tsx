import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Monitor, Puzzle } from "lucide-react"
import { useState, useEffect } from "react"

const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "Alertly_Solbot";

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
    </svg>
  );
}

export function ConnectionsCard() {
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [extensionSynced, setExtensionSynced] = useState(false);
  const [linkCommand, setLinkCommand] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/telegram-link')
      .then(res => res.json())
      .then(data => setTelegramLinked(data.linked))
      .catch(() => {});

    fetch('/api/extension/sync')
      .then(res => res.json())
      .then(data => setExtensionSynced(!!data.authenticated))
      .catch(() => {});
  }, []);

  const createTelegramLinkCommand = async () => {
    setLinkError(null);
    setLinking(true);
    window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}`, '_blank');
    try {
      const res = await fetch('/api/auth/telegram-link/request', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setLinkError(data?.message || 'Failed to generate link token.');
        return;
      }
      setLinkCommand(data.command || null);
      if (data?.token) {
        window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${data.token}`, '_blank');
      }
    } catch {
      setLinkError('Failed to reach server.');
    } finally {
      setLinking(false);
    }
  };

  return (
    <Card className="bg-zinc-950 border-zinc-900 p-5 rounded-[2rem]">
      <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
        <Monitor className="w-3.5 h-3.5 text-[#5100fd]" /> Connections
      </h3>

      <div className="space-y-2.5">

        {/* Extension */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${
            extensionSynced
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-zinc-800 border-zinc-700'
          }`}>
            <Puzzle className={`w-4.5 h-4.5 ${extensionSynced ? 'text-green-400' : 'text-zinc-400'}`} style={{ width: 18, height: 18 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-white uppercase tracking-widest">Browser Extension</p>
            <p className={`text-[10px] font-bold mt-0.5 ${extensionSynced ? 'text-green-400' : 'text-zinc-500'}`}>
              {extensionSynced ? 'Synced' : 'Not Connected'}
            </p>
          </div>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${extensionSynced ? 'bg-green-500' : 'bg-zinc-700'}`} />
        </div>

        {/* Telegram */}
        <div className={`p-3.5 rounded-xl bg-zinc-900 border transition-all ${
          telegramLinked ? 'border-zinc-800 hover:border-zinc-700' : 'border-zinc-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${
              telegramLinked
                ? 'bg-[#229ED9]/10 border-[#229ED9]/30'
                : 'bg-zinc-800 border-zinc-700'
            }`}>
              <TelegramIcon className={`w-[18px] h-[18px] ${telegramLinked ? 'text-[#229ED9]' : 'text-zinc-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-white uppercase tracking-widest">Telegram Bot</p>
              <p className={`text-[10px] font-bold mt-0.5 ${telegramLinked ? 'text-[#229ED9]' : 'text-zinc-500'}`}>
                {telegramLinked ? 'Linked' : 'Not Linked'}
              </p>
            </div>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${telegramLinked ? 'bg-[#229ED9]' : 'bg-zinc-700'}`} />
          </div>

          {!telegramLinked && (
            <div className="mt-3 space-y-2.5">
              <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">
                Link your Telegram for real-time alerts:
              </p>
              <Button
                onClick={createTelegramLinkCommand}
                disabled={linking}
                className="w-full bg-[#229ED9] hover:bg-[#1a8abf] h-10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-[#229ED9]/20 flex items-center justify-center gap-2"
              >
                <TelegramIcon className="w-3.5 h-3.5" />
                {linking ? 'Generating…' : 'Connect Telegram'}
              </Button>
              {linkError && (
                <div className="text-[10px] text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg p-2.5">
                  {linkError}
                </div>
              )}
              {linkCommand && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-white bg-black border border-zinc-800 rounded-lg p-2.5 break-all shadow-inner">
                    {linkCommand}
                  </div>
                  <Button
                    onClick={() => window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}`, '_blank')}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 h-9 rounded-xl text-[9px] font-black text-white uppercase flex items-center justify-center gap-2"
                  >
                    <TelegramIcon className="w-3 h-3" /> Open Bot
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </Card>
  );
}
