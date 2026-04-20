#!/usr/bin/env python3
"""
Script para actualizar el tipo_curso de los estudiantes desde el Excel estudiantes_ces.xls

Tipos de curso soportados:
- Curso Regular Diurno
- Curso por Encuentros (se normaliza a "Curso Por Encuentro")
- Enseñanza a Distancia
"""

import sqlite3
import pandas as pd
from pathlib import Path

# ========= Configuración =========
DB_PATH = "local.db"
EXCEL_PATH = "listados/actualizar_tipocurso.xlsx"
SHEET_NAME = 0  # 0 = primera hoja

import datetime

EXCEL_COL_DOCUMENT = "document"
EXCEL_COL_TIPO_CURSO = "tipo_curso"

# Mapeo de normalización de tipos de curso
TIPO_CURSO_MAP = {
    "curso regular diurno": "Curso Regular Diurno",
    "curso por encuentros": "Curso Por Encuentro",
    "curso por encuentro": "Curso Por Encuentro",
    "enseñanza a distancia": "Enseñanza a Distancia",
    "ensenanza a distancia": "Enseñanza a Distancia",
    "ccd": "Curso Regular Diurno",
    "cce": "Curso Por Encuentro",
    "ccpe": "Curso Por Encuentro",
    "ced": "Enseñanza a Distancia",
    "cpe": "Curso Por Encuentro",
    "crd": "Curso Regular Diurno",
}

UPDATE_UPDATED_AT = True
# ================================


def normalize_document(value: str) -> str:
    """Normaliza el documento a 11 dígitos con ceros a la izquierda."""
    if not value or pd.isna(value):
        return ''
    
    # Convertir a string y limpiar
    doc_str = str(value).strip()
    
    # Si es número flotante (notación científica), convertir correctamente
    try:
        # Intentar convertir como float primero (por si viene en notación científica)
        doc_num = float(doc_str)
        # Convertir a entero y luego a string con 11 dígitos
        doc_str = str(int(doc_num))
    except ValueError:
        pass
    
    # Rellenar con ceros a la izquierda hasta 11 dígitos
    doc_str = doc_str.zfill(11)
    
    return doc_str


def normalize_tipo_curso(value: str) -> str | None:
    """Normaliza el valor del tipo de curso según los valores estándar."""
    if not value or pd.isna(value):
        return None
    
    normalized = str(value).strip().lower()
    return TIPO_CURSO_MAP.get(normalized, value)


def pick_table(conn: sqlite3.Connection) -> str:
    """Detecta si existe students y devuelve el nombre correcto."""
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in cur.fetchall()}

    if "students" in tables:
        return "students"
    
    raise RuntimeError("No encontré la tabla 'students' en la base de datos.")


def main():
    if not Path(DB_PATH).exists():
        raise FileNotFoundError(f"No existe la BD: {DB_PATH}")

    if not Path(EXCEL_PATH).exists():
        raise FileNotFoundError(f"No existe el Excel: {EXCEL_PATH}")

    # 1) Leer Excel
    print(f"Leyendo archivo Excel: {EXCEL_PATH}...")
    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME, dtype=str)

    # Validar columnas
    for col in (EXCEL_COL_DOCUMENT, EXCEL_COL_TIPO_CURSO):
        if col not in df.columns:
            raise ValueError(f"Falta la columna '{col}' en el Excel. Columnas encontradas: {list(df.columns)}")

    # Limpiar / normalizar datos
    df = df[[EXCEL_COL_DOCUMENT, EXCEL_COL_TIPO_CURSO]].copy()

    # Normalizar documento a 11 dígitos con ceros a la izquierda
    df[EXCEL_COL_DOCUMENT] = df[EXCEL_COL_DOCUMENT].apply(normalize_document)
    
    # Normalizar tipos de curso
    df[EXCEL_COL_TIPO_CURSO] = df[EXCEL_COL_TIPO_CURSO].apply(normalize_tipo_curso)

    # Quitar filas sin documento o sin tipo_curso
    df = df[
        df[EXCEL_COL_DOCUMENT].notna() 
        & (df[EXCEL_COL_DOCUMENT] != "")
        & df[EXCEL_COL_TIPO_CURSO].notna()
        & (df[EXCEL_COL_TIPO_CURSO] != "")
    ]

    # Quitar duplicados por documento (se queda con el último)
    df = df.drop_duplicates(subset=[EXCEL_COL_DOCUMENT], keep="last")

    print(f"Registros válidos para actualizar: {len(df)}")
    
    # Mostrar resumen de tipos de curso
    print("\nTipos de curso en el Excel:")
    print(df[EXCEL_COL_TIPO_CURSO].value_counts())
    print()

    updates = df.to_records(index=False)

    # 2) Conectar y actualizar
    conn = sqlite3.connect(DB_PATH)
    try:
        table = pick_table(conn)
        cur = conn.cursor()

        # Contar cuántos registros se van a actualizar (en lotes para evitar el límite de variables SQL)
        documents_to_update = [row[0] for row in updates]
        matching_count = 0
        batch_size = 999
        
        for i in range(0, len(documents_to_update), batch_size):
            batch = documents_to_update[i:i + batch_size]
            placeholders = ','.join('?' * len(batch))
            cur.execute(f"SELECT COUNT(*) FROM {table} WHERE document IN ({placeholders})", batch)
            matching_count += cur.fetchone()[0]
        
        print(f"Estudiantes en la BD que coinciden con el Excel: {matching_count}")
        print(f"Estudiantes que NO están en la BD: {len(documents_to_update) - matching_count}")
        print()

        now = int(pd.Timestamp.now().timestamp())

        if UPDATE_UPDATED_AT:
            sql = f"UPDATE {table} SET course_type = ?, updated_at = ? WHERE document = ?"
            params_iter = [(course_type, now, document) for document, course_type in updates]
        else:
            sql = f"UPDATE {table} SET course_type = ? WHERE document = ?"
            params_iter = [(course_type, document) for document, course_type in updates]

        # Transacción
        conn.execute("BEGIN")
        cursor_result = cur.executemany(sql, list(params_iter))
        conn.commit()
        
        updated_count = cursor_result.rowcount

        print("=== Resumen ===")
        print(f"Tabla usada: {table}")
        print(f"Filas en Excel (únicas con tipo_curso válido): {len(df)}")
        print(f"Filas actualizadas en la BD: {updated_count}")
        print(f"Coincidencias encontradas antes de actualizar: {matching_count}")
        print("\nListo!")

        # 3) Renombrar Excel si fue exitoso
        excel_file = Path(EXCEL_PATH)
        if excel_file.exists():
            date_prefix = datetime.datetime.now().strftime("%Y%m%d")
            new_name = f"{date_prefix}_{excel_file.name}"
            new_path = excel_file.parent / new_name
            excel_file.rename(new_path)
            print(f"Excel renombrado correctamente a: {new_path}")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
