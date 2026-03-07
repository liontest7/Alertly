import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

const PROTECTED_PATHS = ["/dashboard", "/profile", "/settings", "/telegram-link"];
const AUTH_PATHS = ["/login", "/connect-wallet"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));

  const cookie = request.cookies.get("auth_token");
  const tokenValue = cookie?.value;

  if (tokenValue) {
    try {
      const decodedToken = decodeURIComponent(tokenValue);
      const payload = await verifyToken(decodedToken);
      if (payload?.user_id) {
        if (isAuthPath) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        return NextResponse.next();
      }
    } catch (e) {
      console.error("Middleware token verification error:", e);
    }
  }

  if (isProtected) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
