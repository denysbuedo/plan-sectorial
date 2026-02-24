import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { analyzeStudent } from "@/lib/etecsa";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { document: singleDoc, documents: docArray } = body;

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

      if (!analysis) {
        results.push({
          document: student.document,
          status: "error",
          message: "Could not reach ETECSA API",
        });
        continue;
      }

      // Update student with ETECSA data
      await db
        .update(students)
        .set({
          isClient: analysis.isClient,
          hasMobileSubscriptionsActive: analysis.hasMobileSubscriptionsActive,
          isChannelConfirmed: analysis.isChannelConfirmed,
          isChannelConfigured: analysis.isChannelConfigured,
          isConfigured: analysis.isConfigured,
          isHolder: analysis.hasMobileSubscriptionsActive,
          updatedAt: new Date(),
        })
        .where(eq(students.document, student.document));

      results.push({
        document: student.document,
        status: "synced",
        data: analysis,
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
