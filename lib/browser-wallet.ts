const WALLET_STORAGE_KEY = "alertly_browser_wallet_v1"

export type BrowserWallet = {
  address: string
  privateKey: string
  createdAt: string
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function getBrowserWallet(): BrowserWallet | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(WALLET_STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as BrowserWallet
  } catch {
    return null
  }
}

export function saveBrowserWallet(wallet: BrowserWallet): void {
  if (typeof window === "undefined") return
  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet))
}

export function removeBrowserWallet(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(WALLET_STORAGE_KEY)
}

export async function generateBrowserWallet(): Promise<BrowserWallet> {
  const { Keypair } = await import("@solana/web3.js")
  const keypair = Keypair.generate()
  const wallet: BrowserWallet = {
    address: keypair.publicKey.toBase58(),
    privateKey: uint8ToBase64(keypair.secretKey),
    createdAt: new Date().toISOString(),
  }
  saveBrowserWallet(wallet)
  return wallet
}

export async function importBrowserWallet(privateKeyInput: string): Promise<BrowserWallet> {
  const { Keypair } = await import("@solana/web3.js")

  let secretKey: Uint8Array
  const trimmed = privateKeyInput.trim()

  try {
    if (trimmed.startsWith("[")) {
      const arr = JSON.parse(trimmed)
      secretKey = new Uint8Array(arr)
    } else {
      secretKey = base64ToUint8(trimmed)
    }
    if (secretKey.length !== 64) throw new Error("bad length")
  } catch {
    throw new Error("Invalid private key. Expected base64 (64 bytes) or JSON byte array.")
  }

  const keypair = Keypair.fromSecretKey(secretKey)
  const wallet: BrowserWallet = {
    address: keypair.publicKey.toBase58(),
    privateKey: uint8ToBase64(secretKey),
    createdAt: new Date().toISOString(),
  }
  saveBrowserWallet(wallet)
  return wallet
}

export async function getWalletBalanceSol(address: string): Promise<number> {
  try {
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js")
    const rpcUrl =
      (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOLANA_RPC_URL) ||
      "https://api.mainnet-beta.solana.com"
    const connection = new Connection(rpcUrl, "confirmed")
    const lamports = await connection.getBalance(new PublicKey(address))
    return lamports / LAMPORTS_PER_SOL
  } catch {
    return 0
  }
}
