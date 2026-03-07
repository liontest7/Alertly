import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await auth(req);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { telegramId } = await req.json();

    if (!telegramId) {
      return NextResponse.json({ message: "Missing Telegram ID" }, { status: 400 });
    }

    const link = await prisma.telegramLink.upsert({
      where: { userId: session.user.id },
      update: { telegramId: String(telegramId) },
      create: {
        userId: session.user.id,
        telegramId: String(telegramId),
      },
    });

    return NextResponse.json({ link }, { status: 200 });
  } catch (error) {
    console.error("Telegram link error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth(req);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const link = await prisma.telegramLink.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ linked: !!link, telegramId: link?.telegramId }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
