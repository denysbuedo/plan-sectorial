#!/usr/bin/env python3
"""
Actualiza el tipo de curso de estudiantes desde un Excel.
Excel debe tener columnas: CI, tipo_curso
"""

import sqlite3
import sys
from pathlib import Path

def update_course_type(db_path: str, excel_path: str):
    try:
        import pandas as pd
    except ImportError:
        print("Error: Instala pandas con: pip install pandas openpyxl")
        sys.exit(1)

    df = pd.read_excel(excel_path)
    df.columns = df.columns.str.strip().str.lower()

    if 'ci' not in df.columns or 'tipo_curso' not in df.columns:
        print("Error: El Excel debe tener columnas 'CI' y 'tipo_curso'")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    updated = 0
    errors = []

    for _, row in df.iterrows():
        ci = str(row['ci']).strip()
        tipo_curso = str(row['tipo_curso']).strip() if pd.notna(row['tipo_curso']) else None

        try:
            cursor.execute(
                "UPDATE students SET course_type = ? WHERE document = ?",
                (tipo_curso, ci)
            )
            if cursor.rowcount > 0:
                updated += 1
            else:
                errors.append(f"CI {ci} no encontrado")
        except Exception as e:
            errors.append(f"Error con CI {ci}: {e}")

    conn.commit()
    conn.close()

    print(f"Actualizados: {updated}")
    if errors:
        print(f"Errores: {len(errors)}")
        for e in errors[:10]:
            print(f"  - {e}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python update_course_type.py <ruta_db> <ruta_excel>")
        sys.exit(1)

    db_path = sys.argv[1]
    excel_path = sys.argv[2]

    if not Path(db_path).exists():
        print(f"Error: No existe {db_path}")
        sys.exit(1)

    if not Path(excel_path).exists():
        print(f"Error: No existe {excel_path}")
        sys.exit(1)

    update_course_type(db_path, excel_path)