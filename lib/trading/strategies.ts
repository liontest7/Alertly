import { TokenAlert, executeTrade } from '../blockchain/solana';

export interface AutoTradeConfig {
  enabled: boolean;
  buyAmount: number;
  maxSlippage: number;
  takeProfit: number;
  stopLoss: number;
  trailingStop: boolean;
}

export async function shouldAutoTrade(alert: TokenAlert, config: AutoTradeConfig): Promise<boolean> {
  if (!config.enabled) return false;
  
  // Example logic: only auto-trade DEX_BOOST with high liquidity and trending up
  if (alert.type === 'DEX_BOOST' && alert.trend === 'up') {
    const liqValue = parseFloat(alert.liquidity.replace(/[^0-9.]/g, ''));
    if (liqValue > 50) return true; 
  }
  
  return false;
}

export async function processAutoTrade(alert: TokenAlert, config: AutoTradeConfig) {
  console.log(`Auto-trading trigger for ${alert.name} at ${alert.address}`);
  return await executeTrade({
    action: 'buy',
    tokenAddress: alert.address,
    amount: config.buyAmount,
    slippage: config.maxSlippage
  });
}
