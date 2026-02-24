import { NextResponse } from "next/server";
import { db } from "@/db";
import { universities } from "@/db/schema";
import { UNIVERSITIES } from "@/lib/universities";

export async function POST() {
  try {
    for (const uni of UNIVERSITIES) {
      await db
        .insert(universities)
        .values({ code: uni.code, name: uni.name, shortName: uni.shortName })
        .onConflictDoNothing();
    }
    return NextResponse.json({ message: "Universities seeded successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to seed universities", details: String(error) },
      { status: 500 }
    );
  }
}
