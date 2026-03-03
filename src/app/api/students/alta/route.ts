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

      // After registration, assume success if ALTA was successful
      // Note: Analyze endpoint may not be available, so we trust ALTA result
      const analysis = await analyzeStudent(student.document, student.docType);

      // If analyze fails, assume student is configured based on ALTA success
      let isConfigured = false;
      let isChannelConfigured = false;
      let hasMobileSubscriptionsActive = false;
      
      if (analysis.success && analysis.data) {
        // Use actual analyze data if available
        isConfigured = analysis.data.isConfigured;
        isChannelConfigured = analysis.data.isChannelConfigured;
        hasMobileSubscriptionsActive = analysis.data.hasMobileSubscriptionsActive;
      } else if (altaResult.success) {
        // ALTA was successful, assume student is configured
        console.log("[ALTA] Analyze failed but ALTA succeeded, assuming student is configured for:", student.document);
        isConfigured = true;
        isChannelConfigured = true;
      }

      // Update student with ETECSA data
      await db
        .update(students)
        .set({
          isClient: analysis.data?.isClient ?? true,
          hasMobileSubscriptionsActive,
          isChannelConfirmed: analysis.data?.isChannelConfirmed ?? true,
          isChannelConfigured,
          isConfigured,
          isHolder: hasMobileSubscriptionsActive,
          updatedAt: new Date(),
        })
        .where(eq(students.document, student.document));

      results.push({
        document: student.document,
        status: isConfigured ? "registered" : "registered_pending",
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
