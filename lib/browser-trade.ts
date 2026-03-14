import type { BrowserWallet } from "./browser-wallet"

const JUPITER_API = "https://lite-api.jup.ag/swap/v1"
const SOL_MINT = "So11111111111111111111111111111111111111112"

export type TradeResult = {
  success: boolean
  txSig?: string
  message: string
}

export async function executeBrowserTrade(
  wallet: BrowserWallet,
  tokenAddress: string,
  amountSol: number,
  slippageBps: number = 1000,
): Promise<TradeResult> {
  try {
    const { Keypair, Connection, VersionedTransaction, LAMPORTS_PER_SOL } =
      await import("@solana/web3.js")

    const b64 = wallet.privateKey
    const binary = atob(b64)
    const secretKey = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) secretKey[i] = binary.charCodeAt(i)
    const keypair = Keypair.fromSecretKey(secretKey)

    const rpcUrl =
      (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOLANA_RPC_URL) ||
      "https://api.mainnet-beta.solana.com"
    const connection = new Connection(rpcUrl, "confirmed")

    const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL)

    const quoteRes = await fetch(
      `${JUPITER_API}/quote?inputMint=${SOL_MINT}&outputMint=${tokenAddress}&amount=${amountLamports}&slippageBps=${slippageBps}`,
      { signal: AbortSignal.timeout(12000) },
    )

    if (!quoteRes.ok) {
      return { success: false, message: `No swap route available (${quoteRes.status})` }
    }

    const quote = await quoteRes.json()
    if (!quote?.routePlan?.length) {
      return { success: false, message: "No liquidity route found for this token" }
    }

    const swapRes = await fetch(`${JUPITER_API}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: keypair.publicKey.toBase58(),
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: 1_000_000,
            priorityLevel: "high",
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!swapRes.ok) {
      return { success: false, message: `Swap build failed (${swapRes.status})` }
    }

    const { swapTransaction } = await swapRes.json()
    if (!swapTransaction) {
      return { success: false, message: "No transaction returned from Jupiter" }
    }

    const txBinary = atob(swapTransaction)
    const txBuf = new Uint8Array(txBinary.length)
    for (let i = 0; i < txBinary.length; i++) txBuf[i] = txBinary.charCodeAt(i)
    const tx = VersionedTransaction.deserialize(txBuf)
    tx.sign([keypair])

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

    const txSig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    })

    const confirmation = await connection.confirmTransaction(
      { signature: txSig, blockhash, lastValidBlockHeight },
      "confirmed",
    )

    if (confirmation.value.err) {
      return { success: false, txSig, message: `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}` }
    }

    return { success: true, txSig, message: "Trade executed successfully" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Trade failed"
    return { success: false, message: msg }
  }
}

export function slippagePctToBps(pct: number): number {
  return Math.round(pct * 100)
}
