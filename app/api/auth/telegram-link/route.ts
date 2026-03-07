import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth(req);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { telegramId: true }
    });
    
    return NextResponse.json({ linked: !!user?.telegramId });
  } catch (error) {
    console.error("Telegram link check error:", error);
    return NextResponse.json({ linked: false });
  }
}
