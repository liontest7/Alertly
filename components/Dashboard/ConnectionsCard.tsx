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
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
        <Monitor className="w-3.5 h-3.5" /> Connections
      </h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-900/30 border border-zinc-900">
          <span className="text-[10px] font-medium text-zinc-400">Extension</span>
          {extensionSynced ? (
            <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">Synced</span>
          ) : (
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-900">Not Connected</span>
          )}
        </div>
        <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-900 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-medium text-zinc-400">Telegram</span>
            {telegramLinked ? (
              <span className="text-green-500 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">Linked</span>
            ) : (
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-900">Not Linked</span>
            )}
          </div>
          {!telegramLinked && (
            <>
              <p className="text-[11px] text-zinc-500">Generate a one-time secure command and send it to our bot once:</p>
              <Button
                onClick={createTelegramLinkCommand}
                disabled={linking}
                className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-9 rounded-xl text-[10px] font-bold text-white"
              >
                {linking ? 'Generating…' : 'Generate /link Command'}
              </Button>
              {linkCommand && (
                <div className="text-[10px] font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-lg p-2 break-all">
                  {linkCommand}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
