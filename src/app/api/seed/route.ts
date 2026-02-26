import { NextResponse } from "next/server";
import { db } from "@/db";
import { universities } from "@/db/schema";
import { UNIVERSITIES } from "@/lib/universities";

export async function POST() {
  try {
    // Check if universities table exists by querying it
    try {
      await db.select().from(universities).limit(1);
    } catch {
      return NextResponse.json(
        { error: "La tabla 'universities' no existe. Ejecuta 'bun db:migrate' primero para crear las tablas." },
        { status: 500 }
      );
    }
    
    for (const uni of UNIVERSITIES) {
      await db
        .insert(universities)
        .values({ code: uni.code, name: uni.name, shortName: uni.shortName })
        .onConflictDoNothing();
    }
    return NextResponse.json({ message: "Universities seeded successfully" });
  } catch (error) {
    const msg = String(error);
    // Check if tables don't exist
    if (msg.includes("no such table") || msg.includes("不存在")) {
      return NextResponse.json(
        { error: "Las tablas de la base de datos no existen. Ejecuta 'bun db:migrate' primero." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to seed universities", details: msg },
      { status: 500 }
    );
  }
}
