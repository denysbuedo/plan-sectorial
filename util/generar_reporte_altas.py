#!/usr/bin/env python3
"""
Genera reporte por universidad de estudiantes con ALTA en mes_actions_log.jsonl
que NO tienen BAJA y que NO están en la BD actual.

Para las BAJAs (que no tienen entity_ids), se usa la última universidad
donde el estudiante fue dado de alta.
"""

import json
import sqlite3
from collections import defaultdict, OrderedDict

LOG_PATH = "mes_actions_log.jsonl"
DB_PATH = "local.db"
OUTPUT_PATH = "reporte_altas_no_en_bd.txt"

def normalize_document(doc: str) -> str:
    doc = str(doc).strip()
    try:
        doc = str(int(float(doc)))
    except ValueError:
        pass
    return doc.zfill(11)

def main():
    print("Procesando mes_actions_log.jsonl...")

    # document -> entity_code (última ALTA conocida)
    doc_entity = {}
    # entity_code -> set of documents con ALTA
    university_altas = defaultdict(set)
    # Documentos con BAJA
    all_bajas = set()

    with open(LOG_PATH) as f:
        for line_num, line in enumerate(f, 1):
            try:
                data = json.loads(line.strip())
            except json.JSONDecodeError:
                continue

            operation = data.get("operation", "")
            documents_str = data.get("documents", "")
            entity_ids_str = data.get("entity_ids", "")

            if not documents_str:
                continue

            documents = [normalize_document(d) for d in documents_str.split(",")]

            if operation == "altas" and entity_ids_str:
                entity_ids = [e.strip() for e in entity_ids_str.split(",")]
                for i, doc in enumerate(documents):
                    entity_id = entity_ids[i] if i < len(entity_ids) else entity_ids[-1]
                    doc_entity[doc] = entity_id
                    university_altas[entity_id].add(doc)
            elif operation == "bajas":
                for doc in documents:
                    all_bajas.add(doc)

    print(f"Total ALTA en log: {len(doc_entity)}")
    print(f"Total BAJA en log: {len(all_bajas)}")

    # Calcular activas por universidad: alta - baja
    # Un documento está "activo" si tiene ALTA y NO tiene BAJA
    university_active = defaultdict(set)
    for doc, entity in doc_entity.items():
        if doc not in all_bajas:
            university_active[entity].add(doc)

    # Leer BD actual
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT document FROM students")
    documents_in_db = set(row[0] for row in cursor.fetchall())
    cursor = conn.execute("SELECT code, short_name, name FROM universities ORDER BY code")
    universities = {row[0]: {"shortName": row[1], "name": row[2]} for row in cursor.fetchall()}
    conn.close()

    # Generar reporte
    lines = []
    total_grand = 0

    for entity_code in sorted(university_active.keys()):
        activas = university_active[entity_code]

        # Que NO están en la BD
        not_in_db = activas - documents_in_db

        if not not_in_db:
            continue

        uni_info = universities.get(entity_code, {"shortName": f"Entidad {entity_code}", "name": ""})
        uni_short = uni_info["shortName"]

        # Contar bajas de esta universidad también
        altas_total = university_altas[entity_code]
        bajas_uni = len(altas_total - activas)  # altas que fueron dadas de baja

        lines.append(f"\n{'='*80}")
        lines.append(f"Universidad: {entity_code} - {uni_short}")
        lines.append(f"Nombre: {uni_info['name']}")
        lines.append(f"Altas en log: {len(altas_total)}")
        lines.append(f"Bajas en log (de esta universidad): {bajas_uni}")
        lines.append(f"Activas (alta sin baja): {len(activas)}")
        lines.append(f"** NO están en la BD: {len(not_in_db)} **")
        lines.append(f"{'='*80}")
        lines.append(f"{'Documento':<14}")
        lines.append(f"{'-'*14}")
        for doc in sorted(not_in_db):
            lines.append(doc)

        total_grand += len(not_in_db)

    with open(OUTPUT_PATH, "w") as f:
        f.write("REPORTE: Estudiantes con ALTA en mes_actions_log.jsonl\n")
        f.write("que NO tienen BAJA y NO están en la BD actual\n")
        f.write(f"{'='*80}\n")
        f.write(f"Total general de estudiantes: {total_grand}\n\n")
        f.write("\n".join(lines))
        f.write(f"\n\n{'='*80}\n")
        f.write(f"TOTAL GENERAL: {total_grand} estudiantes\n")

    print(f"\n{'='*60}")
    print(f"REPORTE GENERADO: {OUTPUT_PATH}")
    print(f"Total general: {total_grand} estudiantes")
    print(f"{'='*60}")

    # Resumen por universidad
    print(f"\n{'Universidad':<15} {'Código':<8} {'Altas':>7} {'Bajas':>7} {'Activas':>8} {'No en BD':>8}")
    print(f"{'-'*15} {'-'*8} {'-'*7} {'-'*7} {'-'*8} {'-'*8}")
    for entity_code in sorted(university_active.keys()):
        activas = university_active[entity_code]
        altas_total = university_altas[entity_code]
        not_in_db = activas - documents_in_db
        if not_in_db or len(activas) > 0:
            uni_short = universities.get(entity_code, {}).get("shortName", "???")
            bajas = len(altas_total - activas)
            print(f"{uni_short:<15} {entity_code:<8} {len(altas_total):>7} {bajas:>7} {len(activas):>8} {len(not_in_db):>8}")


if __name__ == "__main__":
    main()
