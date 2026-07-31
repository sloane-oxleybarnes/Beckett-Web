import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Direct Loops mutations are disabled. Use an authenticated Beckett workflow." },
    { status: 410 },
  );
}
