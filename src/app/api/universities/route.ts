import { NextResponse } from "next/server";
import { db } from "@/db";
import { universities } from "@/db/schema";

export async function GET() {
  try {
    const rows = await db.select().from(universities).orderBy(universities.shortName);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch universities", details: String(error) },
      { status: 500 }
    );
  }
}
