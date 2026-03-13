import { NextResponse } from "next/server";
import { buildAuthToken, getVipStatus, setAuthCookie, verifyWalletSignature } from "@/lib/auth";
import { setGuestSettings, getSettingsPatchFromCookieHeader } from "@/lib/guest-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { wallet_address, signature, message, nonce_token } = await req.json();

    if (!wallet_address || !signature || !message || !nonce_token) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const verification = await verifyWalletSignature({
      walletAddress: String(wallet_address),
      signature: String(signature),
      message: String(message),
      nonceToken: String(nonce_token),
    });

    if (!verification.valid) {
      return NextResponse.json({ message: verification.reason }, { status: 401 });
    }

    const walletAddress = String(wallet_address);
    const vipStatus = await getVipStatus(walletAddress);

    const authToken = await buildAuthToken({ id: walletAddress, walletAddress, vipStatus });

    const response = NextResponse.json({
      authenticated: true,
      user: {
        id: walletAddress,
        user_id: walletAddress,
        walletAddress,
        wallet_address: walletAddress,
        vipStatus,
        vip_status: vipStatus,
      },
    });

    setAuthCookie(response, authToken);

    const guestPatch = getSettingsPatchFromCookieHeader(req.headers.get("cookie"), false);
    if (Object.keys(guestPatch).length > 0) {
      setGuestSettings(response, guestPatch, true);
    }

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json({ authenticated: false, message: "Internal server error during login" }, { status: 500 });
  }
}
