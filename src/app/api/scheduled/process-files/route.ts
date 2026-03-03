/**
 * Scheduled Task: Process altas/bajas files
 * 
 * This endpoint should be called nightly. It:
 * 1. Reads Excel files from the /altas folder and registers students in ETECSA
 * 2. Reads Excel files from the /bajas folder and deregisters students from ETECSA
 * 
 * Excel format expected:
 * - tipo_doc: 1 (CI) or 2 (Pasaporte)
 * - documento: 11 digits
 * - nombre_completo: Full name
 * - entidad: University code
 * 
 * After processing, files are moved to a /processed subfolder with timestamp
 * 
 * POST /api/scheduled/process-files
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq } from "drizzle-orm";
import { altaStudent, bajaStudent } from "@/lib/etecsa";
import * as fs from "fs";
import * as path from "path";

// Simple API key for scheduled tasks (should be configured in environment)
const SCHEDULED_API_KEY = process.env.SCHEDULED_TASK_API_KEY || "scheduled-task-key-change-me";

// Base directory for file processing
const BASE_DIR = process.cwd();
const ALTAS_DIR = path.join(BASE_DIR, "altas");
const BAJAS_DIR = path.join(BASE_DIR, "bajas");
const PROCESSED_DIR = path.join(BASE_DIR, "processed");

interface ExcelRow {
  tipo_doc: number;
  documento: string;
  nombre_completo: string;
  entidad: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function moveFile(filePath: string, type: "altas" | "bajas") {
  ensureDir(PROCESSED_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = path.basename(filePath);
  const newPath = path.join(PROCESSED_DIR, `${timestamp}_${type}_${fileName}`);
  fs.renameSync(filePath, newPath);
  return newPath;
}

async function parseExcelFile(filePath: string): Promise<ExcelRow[]> {
  // Dynamic import for xlsx (ESM module)
  const XLSX = await import("xlsx");
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows.map((row) => ({
    tipo_doc: Number(row.tipo_doc),
    documento: String(row.documento ?? "").trim(),
    nombre_completo: String(row.nombre_completo ?? "").trim(),
    entidad: String(row.entidad ?? "").trim(),
  }));
}

export async function POST(request: NextRequest) {
  // Verify API key
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== SCHEDULED_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[SCHEDULED PROCESS-FILES] Starting file processing...");

  const results = {
    altas: { processed: 0, registered: 0, failed: 0, errors: [] as string[] },
    bajas: { processed: 0, deregistered: 0, failed: 0, errors: [] as string[] },
  };

  try {
    // Process altas files
    if (fs.existsSync(ALTAS_DIR)) {
      const altasFiles = fs.readdirSync(ALTAS_DIR).filter(f => f.endsWith(".xlsx") || f.endsWith(".xls"));
      
      for (const fileName of altasFiles) {
        const filePath = path.join(ALTAS_DIR, fileName);
        console.log(`[SCHEDULED PROCESS-FILES] Processing altas file: ${fileName}`);
        results.altas.processed++;

        try {
          const rows = await parseExcelFile(filePath);
          
          for (const row of rows) {
            // Check if student exists in our database
            const existing = await db
              .select()
              .from(students)
              .where(eq(students.document, row.documento))
              .limit(1);

            if (existing.length === 0) {
              // Insert student first
              await db.insert(students).values({
                docType: row.tipo_doc,
                document: row.documento,
                fullname: row.nombre_completo,
                entity: row.entidad,
                state: "active",
              });
            }

            // Try to register in ETECSA
            const altaResult = await altaStudent({
              docType: row.tipo_doc,
              document: row.documento,
              entity: row.entidad,
            });

            if (altaResult.success) {
              // Update student as registered
              await db
                .update(students)
                .set({
                  isChannelConfigured: true,
                  isChannelConfirmed: true,
                  isConfigured: false,
                  updatedAt: new Date(),
                })
                .where(eq(students.document, row.documento));
              
              results.altas.registered++;
            } else {
              results.altas.failed++;
              results.altas.errors.push(`${row.documento}: ${altaResult.error}`);
            }
          }

          // Move file to processed
          moveFile(filePath, "altas");
          console.log(`[SCHEDULED PROCESS-FILES] Completed altas file: ${fileName}`);
        } catch (err) {
          console.error(`[SCHEDULED PROCESS-FILES] Error processing altas file ${fileName}:`, err);
          results.altas.failed++;
          results.altas.errors.push(`File ${fileName}: ${String(err)}`);
        }
      }
    }

    // Process bajas files
    if (fs.existsSync(BAJAS_DIR)) {
      const bajasFiles = fs.readdirSync(BAJAS_DIR).filter(f => f.endsWith(".xlsx") || f.endsWith(".xls"));
      
      for (const fileName of bajasFiles) {
        const filePath = path.join(BAJAS_DIR, fileName);
        console.log(`[SCHEDULED PROCESS-FILES] Processing bajas file: ${fileName}`);
        results.bajas.processed++;

        try {
          const rows = await parseExcelFile(filePath);
          
          for (const row of rows) {
            // Try to deregister from ETECSA
            const bajaResult = await bajaStudent({
              docType: row.tipo_doc,
              document: row.documento,
            });

            if (bajaResult.success) {
              // Update student as not configured
              await db
                .update(students)
                .set({
                  isChannelConfigured: false,
                  isConfigured: false,
                  state: "baja",
                  updatedAt: new Date(),
                })
                .where(eq(students.document, row.documento));
              
              results.bajas.deregistered++;
            } else {
              results.bajas.failed++;
              results.bajas.errors.push(`${row.documento}: ${bajaResult.error}`);
            }
          }

          // Move file to processed
          moveFile(filePath, "bajas");
          console.log(`[SCHEDULED PROCESS-FILES] Completed bajas file: ${fileName}`);
        } catch (err) {
          console.error(`[SCHEDULED PROCESS-FILES] Error processing bajas file ${fileName}:`, err);
          results.bajas.failed++;
          results.bajas.errors.push(`File ${fileName}: ${String(err)}`);
        }
      }
    }

    console.log(`[SCHEDULED PROCESS-FILES] Completed.`, JSON.stringify(results));

    return NextResponse.json({
      message: "File processing completed",
      ...results,
    });
  } catch (error) {
    console.error("[SCHEDULED PROCESS-FILES] Error:", error);
    return NextResponse.json(
      { error: "File processing failed", details: String(error) },
      { status: 500 }
    );
  }
}
