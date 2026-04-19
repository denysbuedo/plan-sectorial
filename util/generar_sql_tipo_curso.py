#!/usr/bin/env python3
"""
Genera sentencias SQL UPDATE para actualizar el tipo_curso desde CD343300.xlsx

Mapeo de siglas:
  CPE  → Curso Por Encuentro
  CCPE → Curso Por Encuentro
  CRD  → Curso Regular Diurno
  CCD  → Enseñanza a Distancia
  CED  → Enseñanza a Distancia
"""

import pandas as pd
import sqlite3
import time

# ========= Configuración =========
DB_PATH = "local.db"
EXCEL_PATH = "CD343300.xlsx"
SQL_OUTPUT_PATH = "update_tipo_curso.sql"
BATCH_SIZE = 1000  # Sentencias por transacción

TIPO_CURSO_MAP = {
    "CPE": "Curso Por Encuentro",
    "CCPE": "Curso Por Encuentro",
    "CRD": "Curso Regular Diurno",
    "CCD": "Enseñanza a Distancia",
    "CED": "Enseñanza a Distancia",
}

def normalize_document(value) -> str:
    """Normaliza el documento a 11 dígitos con ceros a la izquierda."""
    if value is None or str(value).strip() == "":
        return ""
    doc_str = str(value).strip()
    try:
        doc_num = float(doc_str)
        doc_str = str(int(doc_num))
    except ValueError:
        pass
    return doc_str.zfill(11)


def main():
    print(f"Leyendo {EXCEL_PATH}...")
    df = pd.read_excel(EXCEL_PATH, sheet_name=0, dtype={"document": str, "tipo_curso": str})

    # Normalizar
    df["document"] = df["document"].apply(normalize_document)
    df["tipo_curso_mapped"] = df["tipo_curso"].map(TIPO_CURSO_MAP)

    # Filtrar registros válidos
    df = df[
        df["document"].notna()
        & (df["document"] != "")
        & df["tipo_curso_mapped"].notna()
    ].drop_duplicates(subset=["document"], keep="last")

    print(f"Registros válidos únicos en Excel: {len(df)}")
    print("\nDistribución por tipo de curso:")
    print(df["tipo_curso_mapped"].value_counts())

    # Conectar a la BD para ver cuáles existen
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    documents = df["document"].tolist()
    placeholders = ",".join("?" for _ in documents)
    cursor.execute(f"SELECT document FROM students WHERE document IN ({placeholders})", documents)
    existing_docs = set(row[0] for row in cursor.fetchall())

    matched = df[df["document"].isin(existing_docs)]
    not_found = df[~df["document"].isin(existing_docs)]

    print(f"\nDocumentos que existen en la BD: {len(matched)}")
    print(f"Documentos que NO existen en la BD: {len(not_found)}")

    # Generar SQL
    print(f"\nGenerando {SQL_OUTPUT_PATH}...")

    now = int(time.time())

    with open(SQL_OUTPUT_PATH, "w") as f:
        f.write("-- Update tipo_curso from CD343300.xlsx\n")
        f.write(f"-- Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"-- Total records: {len(matched)}\n\n")
        f.write("BEGIN TRANSACTION;\n\n")

        batch_count = 0
        for _, row in matched.iterrows():
            doc = row["document"]
            course_type = row["tipo_curso_mapped"]
            f.write(
                f"UPDATE students SET course_type = '{course_type}', "
                f"updated_at = {now} WHERE document = '{doc}';\n"
            )
            batch_count += 1
            if batch_count % 5000 == 0:
                f.write(f"\n-- Progress: {batch_count} statements\n")

        f.write("\nCOMMIT;\n")

    print(f"\nArchivo generado: {SQL_OUTPUT_PATH}")
    print(f"Sentencias UPDATE: {len(matched)}")
    print(f"Tamaño estimado: {batch_count} sentencias")

    # Resumen por tipo
    print("\nResumen por tipo de curso:")
    print(matched["tipo_curso_mapped"].value_counts())

    conn.close()


if __name__ == "__main__":
    main()
