/**
 * Scheduled Task: Retry ALTA for unregistered students
 * 
 * This endpoint should be called nightly. It:
 * 1. Finds all active students where isChannelConfigured = false
 * 2. Attempts ALTA (registration) for each of them
 * 
 * POST /api/scheduled/retry-alta
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { altaStudent } from "@/lib/etecsa";

// Simple API key for scheduled tasks (should be configured in environment)
const SCHEDULED_API_KEY = process.env.SCHEDULED_TASK_API_KEY || "scheduled-task-key-change-me";

export async function POST(request: NextRequest) {
  // Verify API key
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== SCHEDULED_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[SCHEDULED RETRY-ALTA] Starting retry ALTA for unregistered students...");

  try {
    // Get all active students where isChannelConfigured is false or null
    const unregisteredStudents = await db
      .select()
      .from(students)
      .where(
        and(
          eq(students.state, "active"),
          or(
            eq(students.isChannelConfigured, false),
            isNull(students.isChannelConfigured)
          )
        )
      );

    console.log(`[SCHEDULED RETRY-ALTA] Found ${unregisteredStudents.length} unregistered students`);

    const results = {
      total: unregisteredStudents.length,
      registered: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const student of unregisteredStudents) {
      console.log(`[SCHEDULED RETRY-ALTA] Attempting ALTA for ${student.document}...`);
      
      const altaResult = await altaStudent({
        docType: student.docType,
        document: student.document,
        entity: student.entity,
      });

      if (altaResult.success) {
        console.log(`[SCHEDULED RETRY-ALTA] ALTA successful for ${student.document}`);
        
        // Update student as registered
        await db
          .update(students)
          .set({
            isChannelConfigured: true,
            isChannelConfirmed: true,
            isConfigured: false, // Will be set to true after next sync
            updatedAt: new Date(),
          })
          .where(eq(students.document, student.document));
        
        results.registered++;
      } else {
        console.log(`[SCHEDULED RETRY-ALTA] ALTA failed for ${student.document}: ${altaResult.error}`);
        results.failed++;
        results.errors.push(`${student.document}: ${altaResult.error}`);
      }
    }

    console.log(`[SCHEDULED RETRY-ALTA] Completed. Registered: ${results.registered}, Failed: ${results.failed}`);

    return NextResponse.json({
      message: "Retry ALTA completed",
      ...results,
    });
  } catch (error) {
    console.error("[SCHEDULED RETRY-ALTA] Error:", error);
    return NextResponse.json(
      { error: "Retry ALTA failed", details: String(error) },
      { status: 500 }
    );
  }
}
