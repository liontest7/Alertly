import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth(req);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const link = await prisma.telegramLink.findUnique({
      where: { userId: session.user.id },
      select: { telegramId: true },
    });

    return NextResponse.json({ linked: Boolean(link?.telegramId) });
  } catch (error) {
    console.error("Telegram link check error:", error);
    return NextResponse.json({ linked: false });
  }
}
