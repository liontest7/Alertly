export const ALERTLY_CONFIG = {
  NAME: 'ALERTLY',
  DESCRIPTION: 'Ultra-Low Latency Blockchain Alert System',
  VERSION: '1.0.0',
  BRAND_COLOR: '#5100fd',
  NETWORK: 'Solana Mainnet',
  ALERT_TYPES: [
    'NEW TOKEN',
    'LIQUIDITY ADDED',
    'VOLUME SPIKE',
    'WHALE ALERT',
    'DEX BOOST',
    'DEX LISTING'
  ],
  RISK_LEVELS: {
    SAFE: { min: 0, max: 3, label: 'Safe', color: '#10b981' },
    MEDIUM: { min: 4, max: 6, label: 'Medium', color: '#f59e0b' },
    DANGEROUS: { min: 7, max: 10, label: 'Dangerous', color: '#ef4444' }
  }
};
