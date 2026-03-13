import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST() {
  return NextResponse.json({ message: "Use Telegram bot /start directly" }, { status: 200 });
}
