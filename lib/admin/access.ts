import { auth } from "@/lib/auth";
  import { siteConfig } from "@/lib/config";

  const DEFAULT_ADMIN_WALLETS = [
    "DajB37qp74UzwND3N1rVWtLdxr55nhvuK2D4x476zmns",
  ];

  export function getAdminWallets(): string[] {
    const envWallets = (process.env.ADMIN_WALLETS || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);

    const configWallets = (siteConfig.adminWallets || []).map(v => v.trim().toLowerCase());

    const defaultWallets = DEFAULT_ADMIN_WALLETS.map(v => v.trim().toLowerCase());

    return Array.from(new Set([...defaultWallets, ...configWallets, ...envWallets]));
  }

  export async function requireAdmin(request: Request) {
    const session = await auth(request);
    const wallet = session?.user?.walletAddress?.toLowerCase();
    const adminWallets = getAdminWallets();

    if (!wallet || !adminWallets.includes(wallet)) {
      return { ok: false as const, session: null };
    }

    return { ok: true as const, session };
  }
  