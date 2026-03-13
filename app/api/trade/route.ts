import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST() {
  return NextResponse.json({ message: "Trading is executed in browser via Jupiter", success: false }, { status: 200 });
}
