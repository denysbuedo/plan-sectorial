"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";

interface BulkStudentRow {
  tipo_doc: number;
  documento: string;
  nombre_completo: string;
  entidad: string;
  tipo_curso?: string;
}

interface UploadResult {
  message: string;
  inserted: number;
  skipped: number;
  errors: { row: number; documento: string; error: string }[];
}

interface ExcelUploadProps {
  onSuccess: () => void;
}

export default function ExcelUpload({ onSuccess }: ExcelUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [parseError, setParseError] = useState("");
  const [preview, setPreview] = useState<BulkStudentRow[]>([]);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError("");
    setResult(null);
    setPreview([]);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        if (rows.length === 0) {
          setParseError("El archivo está vacío o no tiene datos.");
          return;
        }

        // Validate required columns
        const firstRow = rows[0];
        const requiredCols = ["tipo_doc", "documento", "nombre_completo", "entidad"];
        const missingCols = requiredCols.filter((col) => !(col in firstRow));
        if (missingCols.length > 0) {
          setParseError(`Columnas faltantes: ${missingCols.join(", ")}. El archivo debe tener exactamente: tipo_doc, documento, nombre_completo, entidad`);
          return;
        }

        const parsed: BulkStudentRow[] = rows.map((row) => ({
          tipo_doc: Number(row.tipo_doc),
          documento: String(row.documento ?? "").trim(),
          nombre_completo: String(row.nombre_completo ?? "").trim(),
          entidad: String(row.entidad ?? "").trim(),
          tipo_curso: row.tipo_curso ? String(row.tipo_curso).trim() : undefined,
        }));

        setPreview(parsed);
      } catch {
        setParseError("Error al leer el archivo. Asegúrate de que sea un archivo Excel válido (.xlsx o .xls).");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleUpload = async () => {
    if (preview.length === 0) return;
    setUploading(true);
    setResult(null);

    try {
      const res = await fetch("/api/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: preview }),
      });
      const data: UploadResult = await res.json();
      setResult(data);
      if (data.inserted > 0) {
        onSuccess();
      }
    } catch {
      setResult({
        message: "Error de red al subir el archivo",
        inserted: 0,
        skipped: 0,
        errors: [],
      });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setPreview([]);
    setResult(null);
    setParseError("");
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* File input */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          📂 Seleccionar Excel
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        {fileName && (
          <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
            {fileName}
          </span>
        )}
        {(preview.length > 0 || result) && (
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Format hint */}
      {!fileName && (
        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <strong>Formato requerido:</strong> El Excel debe tener las columnas{" "}
          <code className="bg-gray-200 px-1 rounded">tipo_doc</code>,{" "}
          <code className="bg-gray-200 px-1 rounded">documento</code>,{" "}
          <code className="bg-gray-200 px-1 rounded">nombre_completo</code>,{" "}
          <code className="bg-gray-200 px-1 rounded">entidad</code> en la primera fila.
          <br />
          <span className="text-gray-400">tipo_doc: 1=CI, 2=Pasaporte · documento: 11 dígitos · entidad: código de universidad (ej: 50601)</span>
          <br />
          <span className="text-gray-400">Opcional: tipo_curso (Curso Regular Diurno | Curso Por Encuentro)</span>
        </div>
      )}

      {/* Parse error */}
      {parseError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          ⚠️ {parseError}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && !result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Vista previa: <span className="text-indigo-600">{preview.length} registros</span>
            </p>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {uploading ? "Subiendo..." : `⬆ Importar ${preview.length} estudiantes`}
            </button>
          </div>

          {/* Preview table (first 5 rows) */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">#</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Documento</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Entidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 2}</td>
                    <td className="px-3 py-2">{row.tipo_doc === 1 ? "CI" : row.tipo_doc === 2 ? "Pasaporte" : row.tipo_doc}</td>
                    <td className="px-3 py-2 font-mono">{row.documento}</td>
                    <td className="px-3 py-2">{row.nombre_completo}</td>
                    <td className="px-3 py-2">{row.entidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 5 && (
              <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
                ... y {preview.length - 5} registros más
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-lg border p-4 space-y-2 ${result.errors.length > 0 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
          <p className={`text-sm font-medium ${result.errors.length > 0 ? "text-yellow-800" : "text-green-800"}`}>
            {result.message}
          </p>
          <div className="flex gap-4 text-xs">
            <span className="text-green-700">✓ {result.inserted} insertados</span>
            <span className="text-gray-500">⊘ {result.skipped} duplicados</span>
            {result.errors.length > 0 && (
              <span className="text-red-600">✗ {result.errors.length} errores</span>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {result.errors.map((err, i) => (
                <div key={i} className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1">
                  Fila {err.row} ({err.documento || "—"}): {err.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
