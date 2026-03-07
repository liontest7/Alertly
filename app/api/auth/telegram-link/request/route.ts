import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import crypto from "crypto";

const TTL_MINUTES = 10;

export async function POST(req: Request) {
  try {
    const session = await auth(req);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

    const request = await prisma.telegramLinkRequest.upsert({
      where: { userId: session.user.id },
      update: { token, expiresAt },
      create: { userId: session.user.id, token, expiresAt },
    });

    return NextResponse.json(
      {
        token: request.token,
        expiresAt: request.expiresAt,
        command: `/link ${request.token}`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Telegram link request error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
