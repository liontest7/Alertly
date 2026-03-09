#!/usr/bin/env node
import fetch from 'node-fetch';

const API_URL = process.env.ALERTLY_API_BASE_URL || 'http://localhost:10000';

async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/api/health`);
    const health = await response.json();

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
    process.exit(0);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

checkHealth();
