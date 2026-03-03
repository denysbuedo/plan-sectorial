import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students, universities } from "@/db/schema";
import { eq, and, inArray, like, or, sql, isNull } from "drizzle-orm";

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
    
    // Pagination params
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;
    
    // Filter params
    const entity = searchParams.get("entity");
    const state = searchParams.get("state");
    const hasHolder = searchParams.get("hasHolder");
    const isChannelConfigured = searchParams.get("isChannelConfigured");
    const isChannelConfirmed = searchParams.get("isChannelConfirmed");
    const isConfigured = searchParams.get("isConfigured");
    const isClient = searchParams.get("isClient");
    
    // Search params
    const search = searchParams.get("search") || "";
    const university = searchParams.get("university") || "";

    const conditions: any[] = [];

    // Role: universidad → only see their own university
    if (role === "universidad" && userEntity) {
      conditions.push(eq(students.entity, userEntity));
    } else if (entity) {
      conditions.push(eq(students.entity, entity));
    }

    if (state) conditions.push(eq(students.state, state));

    // Filter by holder status (hasMobileSubscriptionsActive - Titular)
    if (hasHolder === "true") {
      conditions.push(eq(students.hasMobileSubscriptionsActive, true));
    } else if (hasHolder === "false") {
      conditions.push(or(eq(students.hasMobileSubscriptionsActive, false), isNull(students.hasMobileSubscriptionsActive)));
    }

    // Filter by ETECSA client status (isClient)
    if (isClient === "true") {
      conditions.push(eq(students.isClient, true));
    } else if (isClient === "false") {
      conditions.push(or(eq(students.isClient, false), isNull(students.isClient)));
    }

    // Filter by registration in ETECSA (isChannelConfigured)
    if (isChannelConfigured === "true") {
      conditions.push(eq(students.isChannelConfigured, true));
    } else if (isChannelConfigured === "false") {
      conditions.push(or(eq(students.isChannelConfigured, false), isNull(students.isChannelConfigured)));
    }

    // Filter by registration in SIGENU (isChannelConfirmed)
    if (isChannelConfirmed === "true") {
      conditions.push(eq(students.isChannelConfirmed, true));
    } else if (isChannelConfirmed === "false") {
      conditions.push(or(eq(students.isChannelConfirmed, false), isNull(students.isChannelConfirmed)));
    }

    // Filter by plan configured status (isConfigured)
    if (isConfigured === "true") {
      conditions.push(eq(students.isConfigured, true));
    } else if (isConfigured === "false") {
      conditions.push(or(eq(students.isConfigured, false), isNull(students.isConfigured)));
    }

    // Search by fullname (contains) or document (exact/contains)
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          like(students.fullname, searchPattern),
          like(students.document, searchPattern)
        )
      );
    }

    // Search by university code
    if (university) {
      conditions.push(eq(students.entity, university));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    // Get stats for the filtered set (not paginated)
    const statsResult = await db
      .select({
        totalActive: sql<number>`count(case when ${students.state} = 'active' then 1 end)`,
        totalHolders: sql<number>`count(case when ${students.hasMobileSubscriptionsActive} = 1 then 1 end)`,
        totalConfigured: sql<number>`count(case when ${students.isConfigured} = 1 then 1 end)`,
        totalRegistered: sql<number>`count(case when ${students.isChannelConfigured} = 1 then 1 end)`,
        totalNotRegistered: sql<number>`count(case when ${students.hasMobileSubscriptionsActive} = 1 and ${students.isConfigured} = 0 then 1 end)`,
      })
      .from(students)
      .where(whereClause);
    const stats = statsResult[0] || { totalActive: 0, totalHolders: 0, totalConfigured: 0, totalRegistered: 0, totalNotRegistered: 0 };

    // Get paginated students
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
      .where(whereClause)
      .orderBy(students.fullname)
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      students: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        active: stats.totalActive,
        holders: stats.totalHolders,
        notRegistered: stats.totalNotRegistered,
        configured: stats.totalConfigured,
        registered: stats.totalRegistered,
      },
    });
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
    console.error("[POST /api/students] Error:", msg);
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Ya existe un estudiante con este documento" },
        { status: 409 }
      );
    }
    if (msg.includes("FOREIGN KEY") || msg.includes("foreign key")) {
      return NextResponse.json(
        { error: "La entidad/universidad no existe. Asegúrese de que las universidades estén cargadas." },
        { status: 400 }
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
