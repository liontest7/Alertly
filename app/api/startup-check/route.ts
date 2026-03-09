import { NextResponse } from "next/server";
import { validateEnvironment } from "@/lib/env-validation";

export async function GET() {
  const { valid, missing } = validateEnvironment();

  if (!valid) {
    return NextResponse.json(
      {
        ready: false,
        message: "Missing required environment variables",
        missing,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ready: true,
      message: "App is ready - all environment variables configured",
    },
    { status: 200 }
  );
}
