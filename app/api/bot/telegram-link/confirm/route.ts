import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEnv } from "@/lib/env";

const INTERNAL_API_KEY = requireEnv("INTERNAL_API_KEY", {
  allowInDev: true,
  devFallback: "dev-internal-api-key",
});

function isAuthorized(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.replace("Bearer ", "") === INTERNAL_API_KEY;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token, telegramId } = await req.json();

    if (!token || !telegramId) {
      return NextResponse.json({ message: "Missing token or telegramId" }, { status: 400 });
    }

    const request = await prisma.telegramLinkRequest.findUnique({
      where: { token: String(token) },
    });

    if (!request) {
      return NextResponse.json({ message: "Invalid link token" }, { status: 404 });
    }

    if (request.expiresAt < new Date()) {
      await prisma.telegramLinkRequest.delete({ where: { token: String(token) } });
      return NextResponse.json({ message: "Link token expired" }, { status: 400 });
    }

    await prisma.telegramLink.upsert({
      where: { userId: request.userId },
      update: { telegramId: String(telegramId) },
      create: { userId: request.userId, telegramId: String(telegramId) },
    });

    await prisma.telegramLinkRequest.delete({ where: { token: String(token) } });

    return NextResponse.json({ linked: true }, { status: 200 });
  } catch (error) {
    console.error("Telegram confirm link error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
