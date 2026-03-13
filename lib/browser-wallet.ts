const WALLET_STORAGE_KEY = "alertly_browser_wallet_v1"

export type BrowserWallet = {
  address: string
  privateKey: string
  createdAt: string
}

// Solana addresses are plain base58 (no checksum)
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

function encodeBase58(input: Uint8Array): string {
  const digits: number[] = [0]
  for (let i = 0; i < input.length; i++) {
    let carry = input[i]
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8
      digits[j] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  let result = ""
  for (let i = 0; i < input.length && input[i] === 0; i++) result += "1"
  for (let i = digits.length - 1; i >= 0; i--) result += BASE58_ALPHABET[digits[i]]
  return result
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
  // tweetnacl is pure JS — no Node.js or Buffer dependencies, safe in all browsers
  const nacl = (await import("tweetnacl")).default
  const keypair = nacl.sign.keyPair()
  const wallet: BrowserWallet = {
    address: encodeBase58(keypair.publicKey),
    privateKey: uint8ToBase64(keypair.secretKey),
    createdAt: new Date().toISOString(),
  }
  saveBrowserWallet(wallet)
  return wallet
}

export async function importBrowserWallet(privateKeyInput: string): Promise<BrowserWallet> {
  const nacl = (await import("tweetnacl")).default

  let secretKey: Uint8Array
  const trimmed = privateKeyInput.trim()

  try {
    if (trimmed.startsWith("[")) {
      // JSON byte array format: [1,2,3,...]
      const arr = JSON.parse(trimmed)
      secretKey = new Uint8Array(arr)
    } else {
      // base64 format
      secretKey = base64ToUint8(trimmed)
    }
    if (secretKey.length !== 64) throw new Error("bad length")
  } catch {
    throw new Error("Invalid private key. Expected base64 (64 bytes) or JSON byte array.")
  }

  const keypair = nacl.sign.keyPair.fromSecretKey(secretKey)
  const wallet: BrowserWallet = {
    address: encodeBase58(keypair.publicKey),
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
