import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await auth(req);
    
    // Debug session
    console.log("Session check:", session ? `User ${session.user.user_id}` : "No session");

    if (!session) {
      return new NextResponse(JSON.stringify({ authenticated: false }), { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        }
      });
    }

    return new NextResponse(JSON.stringify({
      authenticated: true,
      user: session.user,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
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
