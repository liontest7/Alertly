/**
 * Legacy Alert Listener - Now routes to real blockchain listener
 * Kept for backwards compatibility, actual logic moved to blockchain-listener.ts
 */

import { startBlockchainListener, stopBlockchainListener, getListenerStatus } from "./listeners/blockchain-listener";
import { prisma } from "./prisma";

export class AlertListener {
  private isRunning: boolean = false;

  async start() {
    const status = getListenerStatus();
    if (this.isRunning || status.running) {
      this.isRunning = true;
      console.log("Alert listener already running");
      return;
    }

    this.isRunning = true;
    console.log("🚀 Starting real-time alert listener");

    try {
      await startBlockchainListener();

      // Update listener status in database (graceful fallback if table doesn't exist yet)
      try {
        const runtimeStatus = getListenerStatus();
        await prisma.listenerStatus.upsert({
          where: { name: "blockchain-listener" },
          create: {
            name: "blockchain-listener",
            running: true,
            subscriptions: runtimeStatus.subscriptions,
          },
          update: {
            running: true,
            subscriptions: runtimeStatus.subscriptions,
          },
        });
      } catch {
        console.warn("ListenerStatus table not yet migrated, continuing without DB status");
      }
    } catch (error) {
      this.isRunning = false;
      console.error("Failed to start alert listener:", error);
      throw error;
    }
  }

  async stop() {
    const status = getListenerStatus();
    if (!this.isRunning && !status.running) return;

    try {
      await stopBlockchainListener();

      // Graceful DB update
      try {
        await prisma.listenerStatus.upsert({
          where: { name: "blockchain-listener" },
          create: { name: "blockchain-listener", running: false, subscriptions: 0 },
          update: { running: false, subscriptions: 0 },
        });
      } catch {
        console.warn("ListenerStatus table not yet migrated");
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
let listener: AlertListener | null = null;

export function getAlertListener(): AlertListener {
  if (!listener) {
    listener = new AlertListener();
  }
  return listener;
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
    listenerStartPromise = startAlertListener().finally(() => {
      listenerStartPromise = null;
    });
  }

  await listenerStartPromise;
}
