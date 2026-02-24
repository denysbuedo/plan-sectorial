import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { bajaStudent } from "@/lib/etecsa";

export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role") || "";
  // Only admin can deregister students
  if (role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { document: singleDoc, documents: docArray, setLocalBaja = true } = body;

    // Get students to deregister:
    // - documents: string[] → deregister those specific students
    // - document: string   → deregister a single student
    let studentsToDeregister;

    if (docArray && Array.isArray(docArray) && docArray.length > 0) {
      studentsToDeregister = await db
        .select()
        .from(students)
        .where(inArray(students.document, docArray));
    } else if (singleDoc) {
      studentsToDeregister = await db
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

    for (const student of studentsToDeregister) {
      // Deregister (BAJA) in ETECSA
      const bajaResult = await bajaStudent({
        docType: student.docType,
        document: student.document,
      });

      // Optionally update local state to "baja"
      if (setLocalBaja) {
        await db
          .update(students)
          .set({
            state: "baja",
            isHolder: false,
            isClient: false,
            hasMobileSubscriptionsActive: false,
            isChannelConfirmed: false,
            isChannelConfigured: false,
            isConfigured: false,
            updatedAt: new Date(),
          })
          .where(eq(students.document, student.document));
      }

      if (!bajaResult.success) {
        results.push({
          document: student.document,
          status: "error",
          message: bajaResult.error || "Failed to deregister in ETECSA",
          localBaja: setLocalBaja,
        });
        continue;
      }

      results.push({
        document: student.document,
        status: "deregistered",
        localBaja: setLocalBaja,
      });
    }

    return NextResponse.json({
      message: `Deregistered ${results.length} students`,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Deregistration failed", details: String(error) },
      { status: 500 }
    );
  }
}
