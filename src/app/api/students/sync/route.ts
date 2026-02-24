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

  try {
    const body = await request.json().catch(() => ({}));
    const { document: singleDoc, documents: docArray, autoRegister = false } = body;

    // Get students to sync:
    // - documents: string[] → sync those specific students
    // - document: string   → sync a single student (legacy)
    // - (none)             → sync all active students
    let studentsToSync;
    if (docArray && Array.isArray(docArray) && docArray.length > 0) {
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
      const analysis = await analyzeStudent(student.document, student.docType);

      if (!analysis.success || !analysis.data) {
        results.push({
          document: student.document,
          status: "error",
          message: analysis.error || "Could not reach ETECSA API",
        });
        continue;
      }

      // Auto-register (ALTA) if not configured and autoRegister is enabled
      let registrationResult = null;
      if (!analysis.data.isConfigured && autoRegister) {
        registrationResult = await altaStudent({
          docType: student.docType,
          document: student.document,
          entity: student.entity,
        });

        // Re-analyze after registration attempt
        if (registrationResult.success) {
          const reAnalysis = await analyzeStudent(student.document, student.docType);
          if (reAnalysis.success && reAnalysis.data) {
            analysis.data = reAnalysis.data;
          }
        }
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
