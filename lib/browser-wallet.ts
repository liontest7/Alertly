const WALLET_STORAGE_KEY = "alertly_browser_wallet_v1"

export type BrowserWallet = {
  address: string
  privateKey: string
  createdAt: string
}

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

function decodeBase58(input: string): Uint8Array {
  const digits: number[] = [0]
  for (let i = 0; i < input.length; i++) {
    const value = BASE58_ALPHABET.indexOf(input[i])
    if (value < 0) throw new Error("Invalid base58 character: " + input[i])
    let carry = value
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 58
      digits[j] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      digits.push(carry & 0xff)
      carry >>= 8
    }
  }
  let leadingZeros = 0
  for (let i = 0; i < input.length && input[i] === "1"; i++) leadingZeros++
  const bytes = new Uint8Array(leadingZeros + digits.length)
  for (let i = 0; i < digits.length; i++) {
    bytes[leadingZeros + i] = digits[digits.length - 1 - i]
  }
  return bytes
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
      const arr = JSON.parse(trimmed)
      secretKey = new Uint8Array(arr)
    } else if (/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(trimmed)) {
      secretKey = decodeBase58(trimmed)
    } else {
      secretKey = base64ToUint8(trimmed)
    }
    if (secretKey.length !== 64) throw new Error("bad length")
  } catch {
    throw new Error(
      "Invalid private key. Supported formats:\n• Base58 (Phantom / Solflare / Telegram export)\n• Base64 (Alertly website export)\n• JSON byte array [1,2,...,64]"
    )
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

export function exportBrowserWalletKeys(wallet: BrowserWallet): { base64: string; base58: string } {
  const secretKey = base64ToUint8(wallet.privateKey)
  return {
    base64: wallet.privateKey,
    base58: encodeBase58(secretKey),
  }
}

export async function sendSol(wallet: BrowserWallet, toAddress: string, amountSol: number): Promise<string> {
  if (amountSol <= 0) throw new Error("Amount must be greater than 0")

  const { Connection, PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL } = await import("@solana/web3.js")

  const secretKey = base64ToUint8(wallet.privateKey)
  const keypair = Keypair.fromSecretKey(secretKey)

  const rpcUrl =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOLANA_RPC_URL) ||
    "https://api.mainnet-beta.solana.com"
  const connection = new Connection(rpcUrl, "confirmed")

  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL)

  let toPubkey: InstanceType<typeof PublicKey>
  try {
    toPubkey = new PublicKey(toAddress)
  } catch {
    throw new Error("Invalid recipient address")
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const transaction = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey, lamports })
  )
  transaction.recentBlockhash = blockhash
  transaction.feePayer = keypair.publicKey
  transaction.sign(keypair)

  const txId = await connection.sendRawTransaction(transaction.serialize())
  await connection.confirmTransaction({ signature: txId, blockhash, lastValidBlockHeight })
  return txId
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
