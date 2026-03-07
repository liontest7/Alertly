import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await auth(req);
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
      user: session.user,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
