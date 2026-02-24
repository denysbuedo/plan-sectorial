import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";

interface BulkStudentRow {
  tipo_doc: number;
  documento: string;
  nombre_completo: string;
  entidad: string;
}

/**
 * POST /api/students/bulk
 * Bulk insert students from parsed Excel data.
 * Body: { students: BulkStudentRow[] }
 * Returns: { inserted, skipped, errors }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows: BulkStudentRow[] = body.students;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "students must be a non-empty array" },
        { status: 400 }
      );
    }

    let inserted = 0;
    let skipped = 0;
    const errors: { row: number; documento: string; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header

      // Validate fields
      const docType = Number(row.tipo_doc);
      const documento = String(row.documento ?? "").trim();
      const fullname = String(row.nombre_completo ?? "").trim();
      const entity = String(row.entidad ?? "").trim();

      if (!docType || !documento || !fullname || !entity) {
        errors.push({ row: rowNum, documento, error: "Campos requeridos faltantes (tipo_doc, documento, nombre_completo, entidad)" });
        continue;
      }

      if (docType !== 1 && docType !== 2) {
        errors.push({ row: rowNum, documento, error: "tipo_doc debe ser 1 (CI) o 2 (Pasaporte)" });
        continue;
      }

      if (documento.length !== 11) {
        errors.push({ row: rowNum, documento, error: `documento debe tener 11 dígitos (tiene ${documento.length})` });
        continue;
      }

      try {
        await db.insert(students).values({
          docType,
          document: documento,
          fullname,
          entity,
          state: "active",
        });
        inserted++;
      } catch (err) {
        const msg = String(err);
        if (msg.includes("UNIQUE") || msg.includes("unique")) {
          skipped++;
        } else {
          errors.push({ row: rowNum, documento, error: msg });
        }
      }
    }

    return NextResponse.json({
      message: `Procesados ${rows.length} registros: ${inserted} insertados, ${skipped} duplicados omitidos, ${errors.length} errores`,
      inserted,
      skipped,
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process bulk upload", details: String(error) },
      { status: 500 }
    );
  }
}
