import { Card } from "@/components/ui/card"
import { Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

export function ConnectionsCard() {
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [extensionSynced, setExtensionSynced] = useState(false);
  const [linkCommand, setLinkCommand] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

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
    setLinking(true);
    try {
      const res = await fetch('/api/auth/telegram-link/request', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setLinkCommand(data.command || null);
      }
    } catch (error) {
      console.error('Failed to create Telegram link command', error);
    } finally {
      setLinking(false);
    }
  };

  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem]">
      <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
        <Monitor className="w-3.5 h-3.5 text-[#5100fd]" /> Connections
      </h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <span className="text-[11px] font-black text-white uppercase tracking-widest">Extension</span>
          {extensionSynced ? (
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">Synced</span>
          ) : (
            <span className="text-[10px] font-bold text-white uppercase tracking-widest px-3 py-1 rounded-full bg-zinc-950 border border-zinc-800">Not Connected</span>
          )}
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-black text-white uppercase tracking-widest">Telegram Bot</span>
            {telegramLinked ? (
              <span className="text-green-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">Linked</span>
            ) : (
              <span className="text-[10px] font-bold text-white uppercase tracking-widest px-3 py-1 rounded-full bg-zinc-950 border border-zinc-800">Not Linked</span>
            )}
          </div>
          {!telegramLinked && (
            <>
              <p className="text-[12px] text-white font-medium leading-relaxed">Generate a secure command to link your Telegram account for real-time alerts:</p>
              <Button
                onClick={createTelegramLinkCommand}
                disabled={linking}
                className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-11 rounded-xl text-[11px] font-black text-white uppercase tracking-widest shadow-lg shadow-[#5100fd]/20"
              >
                {linking ? 'Generating…' : 'Generate /link Command'}
              </Button>
              {linkCommand && (
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-mono text-white bg-black border border-zinc-800 rounded-lg p-3 break-all shadow-inner">
                    {linkCommand}
                  </div>
                  <Button
                    onClick={() => window.open('https://t.me/alertly_bot', '_blank')}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 h-9 rounded-xl text-[10px] font-black text-white uppercase"
                  >
                    Open Bot
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
