import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ document: string }> }
) {
  const role = request.headers.get("x-user-role") || "";
  if (role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const { document } = await params;
    const body = await request.json();
    const { state } = body;

    if (!state || !["active", "baja", "error"].includes(state)) {
      return NextResponse.json(
        { error: "state must be one of: active, baja, error" },
        { status: 400 }
      );
    }

    const result = await db
      .update(students)
      .set({ state, updatedAt: new Date() })
      .where(eq(students.document, document));

    if (!result) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Student updated", document, state });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update student", details: String(error) },
      { status: 500 }
    );
  }
}
