/**
 * Alert Listener - manages the real-time blockchain listener lifecycle
 * with auto-restart on failure for production resilience.
 */

import { startBlockchainListener, stopBlockchainListener, getListenerStatus } from "./listeners/blockchain-listener";
import { startAutomationScheduler, stopAutomationScheduler } from "./automation-scheduler";
import { prisma } from "./prisma";

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
      startAutomationScheduler();
      this.scheduleHealthCheck();

      try {
        const runtimeStatus = getListenerStatus();
        await prisma.listenerStatus.upsert({
          where: { name: "blockchain-listener" },
          create: { name: "blockchain-listener", running: true, subscriptions: runtimeStatus.subscriptions },
          update: { running: true, subscriptions: runtimeStatus.subscriptions },
        });
      } catch {
        // ListenerStatus table may not exist yet — not fatal
      }
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
      stopAutomationScheduler();

      try {
        await prisma.listenerStatus.upsert({
          where: { name: "blockchain-listener" },
          create: { name: "blockchain-listener", running: false, subscriptions: 0 },
          update: { running: false, subscriptions: 0 },
        });
      } catch {
        // Not fatal
      }

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

// Singleton instance
let listenerInstance: AlertListener | null = null;

export function getAlertListener(): AlertListener {
  if (!listenerInstance) {
    listenerInstance = new AlertListener();
  }
  return listenerInstance;
}

export async function startAlertListener() {
  const listener = getAlertListener();
  await listener.start();
}

let listenerStartPromise: Promise<void> | null = null;

export async function ensureAlertListenerStarted() {
  const status = getListenerStatus();
  if (status.running) return;

  if (!listenerStartPromise) {
    listenerStartPromise = startAlertListener().catch((err) => {
      console.error("ensureAlertListenerStarted error:", err instanceof Error ? err.message : err);
    }).finally(() => {
      listenerStartPromise = null;
    });
  }

  await listenerStartPromise;
}
