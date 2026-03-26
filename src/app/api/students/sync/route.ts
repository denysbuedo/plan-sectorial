import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { analyzeStudent } from "@/lib/etecsa";

export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role") || "";
  // Only admin can sync
  if (role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  console.log("[SYNC] Starting sync... role:", role);

  try {
    const body = await request.json().catch(() => ({}));
    const { document: singleDoc, documents: docArray, entity: entityCode } = body;
    console.log("[SYNC] Request body:", { singleDoc, docArray: docArray?.length, entityCode });

    // Get students to sync:
    // - documents: string[] → sync those specific students
    // - document: string   → sync a single student (legacy)
    // - entity: string     → sync all students of that entity
    // - (none)             → sync all active students
    // NOTE: Sync is purely a read operation - it only queries ETECSA and updates local data.
    // It does NOT auto-register students. Registration (ALTA) must be done separately.
    let studentsToSync;
    if (entityCode) {
      // Sync all students of a specific entity
      studentsToSync = await db
        .select()
        .from(students)
        .where(eq(students.entity, entityCode));
    } else if (docArray && Array.isArray(docArray) && docArray.length > 0) {
      studentsToSync = await db
        .select()
        .from(students)
        .where(inArray(students.document, docArray));
    } else if (singleDoc) {
      studentsToSync = await db
        .select()
        .from(students)
        .where(eq(students.document, singleDoc));
    } else {
      studentsToSync = await db
        .select()
        .from(students)
        .where(eq(students.state, "active"));
    }

    const results = [];

    for (const student of studentsToSync) {
      console.log("[SYNC] Processing student:", student.document);
      
      const analysis = await analyzeStudent(student.document, student.docType);
      
      console.log("[SYNC] Analysis result for", student.document, ":", JSON.stringify(analysis));

      // If analyze fails, just mark as error - no auto-registration
      // Registration (ALTA) must be done separately via the ALTA endpoint
      if (!analysis.success || !analysis.data) {
        console.log("[SYNC] Analysis failed for", student.document, ":", analysis.error);
        results.push({
          document: student.document,
          status: "error",
          message: analysis.error || "Could not reach ETECSA API",
        });
        continue;
      }

      // Update student with ETECSA data
      console.log("[SYNC] Updating student", student.document, "with:", JSON.stringify({
        isClient: analysis.data.isClient,
        hasMobileSubscriptionsActive: analysis.data.hasMobileSubscriptionsActive,
        isChannelConfirmed: analysis.data.isChannelConfirmed,
        isChannelConfigured: analysis.data.isChannelConfigured,
        isConfigured: analysis.data.isConfigured,
        isHolder: analysis.data.hasMobileSubscriptionsActive,
      }));
      
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

      // Verify what was saved
      const verify = await db.select({ isConfigured: students.isConfigured }).from(students).where(eq(students.document, student.document));
      console.log("[SYNC] Verify save for", student.document, ": isConfigured =", verify[0]?.isConfigured);

      results.push({
        document: student.document,
        status: analysis.data.isConfigured ? "synced" : "not_configured",
        data: analysis.data,
      });
    }

    return NextResponse.json({
      message: `Synced ${results.length} students`,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Sync failed", details: String(error) },
      { status: 500 }
    );
  }
}
