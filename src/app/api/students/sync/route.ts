import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { analyzeStudent, altaStudent } from "@/lib/etecsa";

export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role") || "";
  // Only admin can sync
  if (role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  console.log("[SYNC] Starting sync... role:", role);

  try {
    const body = await request.json().catch(() => ({}));
    const { document: singleDoc, documents: docArray, entity: entityCode, autoRegister = false } = body;
    console.log("[SYNC] Request body:", { singleDoc, docArray: docArray?.length, entityCode, autoRegister });

    // Get students to sync:
    // - documents: string[] → sync those specific students
    // - document: string   → sync a single student (legacy)
    // - entity: string     → sync all students of that entity
    // - (none)             → sync all active students
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

      // If analyze fails with 400, student doesn't exist in ETECSA - try ALTA
      let registrationResult = null;
      const isNotFound = analysis.error === "http_400";
      
      if (isNotFound && autoRegister) {
        console.log("[SYNC] Student not found in ETECSA (400), attempting ALTA for:", student.document);
        registrationResult = await altaStudent({
          docType: student.docType,
          document: student.document,
          entity: student.entity,
        });

        console.log("[SYNC] ALTA result for", student.document, ":", registrationResult);

        // ALTA succeeded - assume basic configuration
        if (registrationResult.success) {
          analysis.data = {
            isClient: false,
            hasMobileSubscriptionsActive: false,
            isChannelConfirmed: true,
            isChannelConfigured: true, // Can receive service after ALTA
            isConfigured: false, // Needs sync to verify full configuration
          };
          analysis.success = true;
        } else {
          // ALTA failed - log the error
          console.log("[SYNC] ALTA failed for", student.document, ":", registrationResult.error);
        }
      }

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

      results.push({
        document: student.document,
        status: analysis.data.isConfigured ? "synced" : "not_configured",
        data: analysis.data,
        registered: registrationResult ? registrationResult.success : undefined,
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
