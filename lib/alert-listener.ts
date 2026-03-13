import { startBlockchainListener, stopBlockchainListener, getListenerStatus } from "./listeners/blockchain-listener";

const RESTART_DELAY_MS = 15_000;
let autoRestartTimer: ReturnType<typeof setTimeout> | null = null;

export class AlertListener {
  private isRunning: boolean = false;

  async start() {
    const status = getListenerStatus();
    if (this.isRunning || status.running) {
      this.isRunning = true;
      return;
    }

    this.isRunning = true;
    console.log("🚀 Starting real-time alert listener");

    try {
      await startBlockchainListener();
      this.scheduleHealthCheck();
    } catch (error) {
      this.isRunning = false;
      console.error("Failed to start alert listener:", error instanceof Error ? error.message : error);
      this.scheduleRestart();
    }
  }

  private scheduleHealthCheck() {
    if (autoRestartTimer) return;
    autoRestartTimer = setInterval(async () => {
      const status = getListenerStatus();
      if (!status.running) {
        console.warn("⚠️  Blockchain listener stopped unexpectedly — restarting...");
        this.isRunning = false;
        if (autoRestartTimer) {
          clearInterval(autoRestartTimer);
          autoRestartTimer = null;
        }
        await this.start();
      }
    }, RESTART_DELAY_MS);
  }

  private scheduleRestart() {
    setTimeout(async () => {
      console.log("🔄 Retrying blockchain listener startup...");
      this.isRunning = false;
      await this.start();
    }, RESTART_DELAY_MS);
  }

  async stop() {
    const status = getListenerStatus();
    if (!this.isRunning && !status.running) return;

    if (autoRestartTimer) {
      clearInterval(autoRestartTimer);
      autoRestartTimer = null;
    }

    try {
      await stopBlockchainListener();
      this.isRunning = false;
      console.log("⏹️  Alert listener stopped");
    } catch (error) {
      console.error("Error stopping listener:", error);
    }
  }

  getStatus() {
    return getListenerStatus();
  }
}

const alertListener = new AlertListener();
let ensureStartedPromise: Promise<void> | null = null;

export async function ensureAlertListenerStarted(): Promise<void> {
  if (!ensureStartedPromise) {
    ensureStartedPromise = alertListener.start().catch((err) => {
      console.error("Alert listener start error:", err);
      ensureStartedPromise = null;
    });
  }
  return ensureStartedPromise;
}

export function getAlertListenerStatus() {
  return alertListener.getStatus();
}

export async function startAlertListener(): Promise<void> {
  return alertListener.start();
}

export async function stopAlertListener(): Promise<void> {
  return alertListener.stop();
}
