/**
 * Scheduled Task: Full sync of all active students
 * 
 * This endpoint should be called nightly. It:
 * 1. Syncs all active students with ETECSA
 * 2. If a student was not a holder before but is now (hasMobileSubscriptionsActive = true)
 *    and isChannelConfigured = false, it automatically registers them (ALTA)
 * 
 * POST /api/scheduled/sync
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { analyzeStudent, altaStudent } from "@/lib/etecsa";

// Simple API key for scheduled tasks (should be configured in environment)
const SCHEDULED_API_KEY = process.env.SCHEDULED_TASK_API_KEY || "scheduled-task-key-change-me";

export async function POST(request: NextRequest) {
  // Verify API key
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== SCHEDULED_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[SCHEDULED SYNC] Starting nightly sync...");

  try {
    // Get all active students
    const activeStudents = await db
      .select()
      .from(students)
      .where(eq(students.state, "active"));

    console.log(`[SCHEDULED SYNC] Found ${activeStudents.length} active students`);

    const results = {
      total: activeStudents.length,
      synced: 0,
      errors: 0,
      newHoldersRegistered: 0,
      newHoldersSkipped: 0,
    };

    for (const student of activeStudents) {
      // First, analyze the student
      const analysis = await analyzeStudent(student.document, student.docType);
      
      if (!analysis.success || !analysis.data) {
        console.log(`[SCHEDULED SYNC] Analysis failed for ${student.document}: ${analysis.error}`);
        results.errors++;
        continue;
      }

      // Check if this student became a holder now (wasn't before)
      const wasHolder = student.hasMobileSubscriptionsActive === true;
      const isNowHolder = analysis.data.hasMobileSubscriptionsActive === true;
      const isNotConfigured = analysis.data.isChannelConfigured === false;

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

      results.synced++;

      // Auto-register if: became holder + wasn't configured
      if (!wasHolder && isNowHolder && isNotConfigured) {
        console.log(`[SCHEDULED SYNC] Student ${student.document} became holder, attempting ALTA...`);
        
        const altaResult = await altaStudent({
          docType: student.docType,
          document: student.document,
          entity: student.entity,
        });

        if (altaResult.success) {
          console.log(`[SCHEDULED SYNC] ALTA successful for ${student.document}`);
          results.newHoldersRegistered++;
          
          // Update with assumed values after ALTA
          await db
            .update(students)
            .set({
              isChannelConfigured: true,
              isChannelConfirmed: true,
              updatedAt: new Date(),
            })
            .where(eq(students.document, student.document));
        } else {
          console.log(`[SCHEDULED SYNC] ALTA failed for ${student.document}: ${altaResult.error}`);
          results.newHoldersSkipped++;
        }
      }
    }

    console.log(`[SCHEDULED SYNC] Completed. Synced: ${results.synced}, Errors: ${results.errors}, New holders registered: ${results.newHoldersRegistered}`);

    return NextResponse.json({
      message: "Scheduled sync completed",
      ...results,
    });
  } catch (error) {
    console.error("[SCHEDULED SYNC] Error:", error);
    return NextResponse.json(
      { error: "Scheduled sync failed", details: String(error) },
      { status: 500 }
    );
  }
}
