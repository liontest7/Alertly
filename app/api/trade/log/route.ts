import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST() {
  return NextResponse.json({ message: "Trade logs managed in browser localStorage" }, { status: 200 });
}
