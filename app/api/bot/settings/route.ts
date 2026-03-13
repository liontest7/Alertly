import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ message: "Bot settings managed in Telegram" }); }
export async function POST() { return NextResponse.json({ message: "Bot settings managed in Telegram" }); }
