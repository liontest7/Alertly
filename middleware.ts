import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

const PROTECTED_PATHS = ["/profile", "/settings", "/telegram-link"];
const AUTH_PATHS = ["/login", "/connect-wallet"];
const PUBLIC_PATHS = ["/_next", "/api/startup-check", "/api/health"];

// Check if all required environment variables are present
function validateRequiredEnvVars(): { valid: boolean; missing: string[] } {
  const required = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "SOLANA_RPC_URL",
    "TELEGRAM_BOT_TOKEN",
    "ENCRYPTION_KEY",
    "INTERNAL_API_KEY",
    "NEXT_PUBLIC_APP_URL",
    "ALERTLY_API_BASE_URL",
  ];
  
  const missing = required.filter(key => !process.env[key]);
  return { valid: missing.length === 0, missing };
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path)) || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check environment before allowing any other requests
  const { valid, missing } = validateRequiredEnvVars();
  if (!valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: "System not ready - missing environment variables",
          missing,
          message: "Add secrets in Replit: DATABASE_URL, AUTH_SECRET, SOLANA_RPC_URL, TELEGRAM_BOT_TOKEN, ENCRYPTION_KEY, INTERNAL_API_KEY"
        },
        { status: 503 }
      );
    }
    
    // For web pages, redirect to error page
    return NextResponse.redirect(new URL("/startup-error?missing=" + missing.join(","), request.url));
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
        const response = NextResponse.next();
        // Ensure the token persists
        response.cookies.set("auth_token", tokenValue, {
          httpOnly: true,
          sameSite: "lax",
          secure: request.nextUrl.protocol === "https:",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
        return response;
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
