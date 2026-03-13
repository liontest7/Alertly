import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST() {
  return NextResponse.json({ message: "Use browser wallet generation" }, { status: 200 });
}
