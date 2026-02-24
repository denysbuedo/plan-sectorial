import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students, universities } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

function getRequestUser(request: NextRequest) {
  return {
    role: request.headers.get("x-user-role") || "",
    entity: request.headers.get("x-user-entity") || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { role, entity: userEntity } = getRequestUser(request);
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity");
    const state = searchParams.get("state");

    const conditions = [];

    // Role: universidad → only see their own university
    if (role === "universidad" && userEntity) {
      conditions.push(eq(students.entity, userEntity));
    } else if (entity) {
      conditions.push(eq(students.entity, entity));
    }

    if (state) conditions.push(eq(students.state, state));

    const rows = await db
      .select({
        document: students.document,
        docType: students.docType,
        fullname: students.fullname,
        entity: students.entity,
        state: students.state,
        isHolder: students.isHolder,
        isClient: students.isClient,
        hasMobileSubscriptionsActive: students.hasMobileSubscriptionsActive,
        isChannelConfirmed: students.isChannelConfirmed,
        isChannelConfigured: students.isChannelConfigured,
        isConfigured: students.isConfigured,
        createdAt: students.createdAt,
        updatedAt: students.updatedAt,
        universityName: universities.name,
        universityShortName: universities.shortName,
      })
      .from(students)
      .leftJoin(universities, eq(students.entity, universities.code))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch students", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { role } = getRequestUser(request);
  // Only admin can create students
  if (role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { docType, document, fullname, entity } = body;

    if (!docType || !document || !fullname || !entity) {
      return NextResponse.json(
        { error: "Missing required fields: docType, document, fullname, entity" },
        { status: 400 }
      );
    }

    // Validate docType
    if (docType !== 1 && docType !== 2) {
      return NextResponse.json(
        { error: "docType must be 1 (CI) or 2 (Pasaporte)" },
        { status: 400 }
      );
    }

    // Validate document length
    if (document.length !== 11) {
      return NextResponse.json(
        { error: "document must be 11 digits" },
        { status: 400 }
      );
    }

    // Insert student
    await db.insert(students).values({
      docType,
      document,
      fullname,
      entity,
      state: "active",
    });

    return NextResponse.json({ message: "Student created successfully" }, { status: 201 });
  } catch (error) {
    const msg = String(error);
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Student with this document already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create student", details: msg },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/students
 * Bulk update state for multiple students
 * Body: { documents: string[], state: "active" | "baja" | "error" }
 */
export async function PATCH(request: NextRequest) {
  const { role } = getRequestUser(request);
  // Only admin can change student state
  if (role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { documents: docArray, state } = body;

    if (!docArray || !Array.isArray(docArray) || docArray.length === 0) {
      return NextResponse.json(
        { error: "documents must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!state || !["active", "baja", "error"].includes(state)) {
      return NextResponse.json(
        { error: "state must be one of: active, baja, error" },
        { status: 400 }
      );
    }

    await db
      .update(students)
      .set({ state, updatedAt: new Date() })
      .where(inArray(students.document, docArray));

    return NextResponse.json({
      message: `Updated ${docArray.length} students to state: ${state}`,
      documents: docArray,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update students", details: String(error) },
      { status: 500 }
    );
  }
}
