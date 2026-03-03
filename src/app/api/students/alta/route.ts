import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { altaStudent, analyzeStudent } from "@/lib/etecsa";

export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role") || "";
  // Only admin can register students
  if (role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { document: singleDoc, documents: docArray, entity: entityCode } = body;

    // Get students to register:
    // - documents: string[] → register those specific students
    // - document: string   → register a single student
    // - entity: string     → register all students of that entity
    let studentsToRegister;

    if (entityCode) {
      // Register all students of a specific entity
      studentsToRegister = await db
        .select()
        .from(students)
        .where(eq(students.entity, entityCode));
    } else if (docArray && Array.isArray(docArray) && docArray.length > 0) {
      studentsToRegister = await db
        .select()
        .from(students)
        .where(and(eq(students.state, "active"), inArray(students.document, docArray)));
    } else if (singleDoc) {
      studentsToRegister = await db
        .select()
        .from(students)
        .where(eq(students.document, singleDoc));
    } else {
      return NextResponse.json(
        { error: "Se requiere documento o lista de documentos" },
        { status: 400 }
      );
    }

    const results = [];

    for (const student of studentsToRegister) {
      console.log("[ALTA] Attempting to register student:", student.document, "entity:", student.entity, "docType:", student.docType);
      
      // First try to register (ALTA) in ETECSA
      const altaResult = await altaStudent({
        docType: student.docType,
        document: student.document,
        entity: student.entity,
      });

      console.log("[ALTA] Result for", student.document, ":", altaResult);

      if (!altaResult.success) {
        console.error("[ALTA] Failed for", student.document, ":", altaResult.error);
        results.push({
          document: student.document,
          status: "error",
          message: altaResult.error || "Failed to register in ETECSA",
        });
        continue;
      }

      // After registration, analyze to get updated status
      const analysis = await analyzeStudent(student.document, student.docType);

      if (!analysis.success || !analysis.data) {
        results.push({
          document: student.document,
          status: "registered",
          message: "Registered but could not verify status",
        });
        continue;
      }

      // Update student with ETECSA data
      await db
        .update(students)
        .set({
          isClient: analysis.data.isClient,
          hasMobileSubscriptionsActive: analysis.data.hasMobileSubscriptionsActive,
          isChannelConfirmed: analysis.data.isChannelConfirmed,
          isChannelConfigured: analysis.data.isChannelConfigured,
          isConfigured: analysis.data.isConfigured,
          isHolder: analysis.data.hasMobileSubscriptionsActive,
          updatedAt: new Date(),
        })
        .where(eq(students.document, student.document));

      results.push({
        document: student.document,
        status: analysis.data.isConfigured ? "registered" : "registered_pending",
        data: analysis.data,
      });
    }

    return NextResponse.json({
      message: `Registered ${results.length} students`,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Registration failed", details: String(error) },
      { status: 500 }
    );
  }
}
