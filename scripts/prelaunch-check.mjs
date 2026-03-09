#!/usr/bin/env node
const API_URL = process.env.ALERTLY_API_BASE_URL || 'http://localhost:10000';
const RETRIES = Number(process.env.PRELAUNCH_RETRIES || 5);
const RETRY_DELAY_MS = Number(process.env.PRELAUNCH_RETRY_DELAY_MS || 2000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_URL}/api/health`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`health endpoint returned status ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function checkHealth() {
  let health;
  let attemptError;

  for (let i = 1; i <= RETRIES; i += 1) {
    try {
      health = await fetchHealth();
      break;
    } catch (error) {
      attemptError = error;
      if (i < RETRIES) {
        console.warn(`⚠️ health check attempt ${i}/${RETRIES} failed, retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  if (!health) {
    console.error('❌ Health check failed:', attemptError instanceof Error ? attemptError.message : attemptError);
    console.error(`Hint: make sure the app server is running and reachable at ${API_URL}`);
    process.exit(1);
  }

  console.log('\n=== Alertly Pre-Launch Health Check ===\n');
  console.log(`API: ${health.api}`);
  console.log(`Database: ${health.database}`);
  console.log(`Solana RPC: ${health.solanaRpc}`);
  console.log(`Jupiter API: ${health.jupiter}`);
  console.log(`Ready for Launch: ${health.readyForLaunch ? '✅ YES' : '❌ NO'}\n`);

  if (!health.readyForLaunch) {
    console.log('⚠️  Not all systems ready. Check the following:\n');
    if (health.database === 'error') console.log('  • Database connection failed');
    if (health.solanaRpc === 'error') console.log('  • Solana RPC unreachable');
    if (health.jupiter === 'error') console.log('  • Jupiter API unreachable');

    const missing = Object.entries(health.env || {})
      .filter(([_, v]) => !v)
      .map(([k]) => k);

    if (missing.length > 0) {
      console.log(`  • Missing env: ${missing.join(', ')}`);
    }
    process.exit(1);
  }

  console.log('✅ All systems ready for launch!\n');
}

checkHealth().catch((error) => {
  console.error('❌ Unexpected prelaunch failure:', error instanceof Error ? error.message : error);
  process.exit(1);
});
