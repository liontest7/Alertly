import { auth } from "@/lib/auth";

const DEFAULT_ADMIN_WALLETS = [
  "DajB37qp74UzwND3N1rVWtLdxr55nhvuK2D4x476zmns",
];

export function getAdminWallets(): string[] {
  const envWallets = (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_ADMIN_WALLETS, ...envWallets]));
}

export async function requireAdmin(request: Request) {
  const session = await auth(request);
  const wallet = session?.user?.walletAddress;
  const adminWallets = getAdminWallets();

  if (!wallet || !adminWallets.includes(wallet)) {
    return { ok: false as const, session: null };
  }

  return { ok: true as const, session };
}
