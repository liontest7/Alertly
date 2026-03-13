import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ message: "Trading wallet managed in browser" }, { status: 200 });
}
