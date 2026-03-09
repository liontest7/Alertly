import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth(req);
    
    // Debug session
    // console.log("Session check:", session ? `User ${session.user.user_id}` : "No session");

    if (!session) {
      return NextResponse.json({ authenticated: false }, { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        user_id: session.user.id,
        walletAddress: session.user.walletAddress,
        wallet_address: session.user.walletAddress,
        vipStatus: session.user.vipStatus,
        vip_status: session.user.vipStatus,
        isAdmin: (session.user as any).isAdmin || false,
      },
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error("Session API Error:", error);
    return new NextResponse(JSON.stringify({ authenticated: false }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
