import sqlite3
import pandas as pd
import time
from pathlib import Path

# ========= Configuración =========
DB_PATH = "local.db"
EXCEL_PATH = "archivo.xlsx"  # <-- cambia esto
SHEET_NAME = 0              # 0 = primera hoja, o pon el nombre: "Hoja1"

EXCEL_COL_DOCUMENT = "documento"
EXCEL_COL_FULLNAME = "nombre_completo"

UPDATE_UPDATED_AT = True    # pon False si no quieres tocar updated_at
# ================================


def pick_table(conn: sqlite3.Connection) -> str:
    """Detecta si existe students o studends y devuelve el nombre correcto."""
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in cur.fetchall()}

    if "students" in tables:
        return "students"
    if "studends" in tables:
        return "studends"

    raise RuntimeError("No encontré tabla 'students' ni 'studends' en la base de datos.")


def main():
    if not Path(DB_PATH).exists():
        raise FileNotFoundError(f"No existe la BD: {DB_PATH}")

    if not Path(EXCEL_PATH).exists():
        raise FileNotFoundError(f"No existe el Excel: {EXCEL_PATH}")

    # 1) Leer Excel
    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME, dtype=str)

    # Validar columnas
    for col in (EXCEL_COL_DOCUMENT, EXCEL_COL_FULLNAME):
        if col not in df.columns:
            raise ValueError(f"Falta la columna '{col}' en el Excel. Columnas encontradas: {list(df.columns)}")

    # Limpiar / normalizar
    df = df[[EXCEL_COL_DOCUMENT, EXCEL_COL_FULLNAME]].copy()
    df[EXCEL_COL_DOCUMENT] = df[EXCEL_COL_DOCUMENT].astype(str).str.strip()
    df[EXCEL_COL_FULLNAME] = df[EXCEL_COL_FULLNAME].astype(str).str.strip()

    # Quitar filas sin documento
    df = df[df[EXCEL_COL_DOCUMENT].notna() & (df[EXCEL_COL_DOCUMENT] != "")]
    # Quitar duplicados por documento (se queda con el último)
    df = df.drop_duplicates(subset=[EXCEL_COL_DOCUMENT], keep="last")

    updates = df.to_records(index=False)

    # 2) Conectar y actualizar
    conn = sqlite3.connect(DB_PATH)
    try:
        table = pick_table(conn)
        cur = conn.cursor()

        now = int(time.time())

        if UPDATE_UPDATED_AT:
            sql = f"UPDATE {table} SET fullname = ?, updated_at = ? WHERE document = ?"
            params_iter = ((fullname, now, document) for document, fullname in updates)
        else:
            sql = f"UPDATE {table} SET fullname = ? WHERE document = ?"
            params_iter = ((fullname, document) for document, fullname in updates)

        # Transacción
        conn.execute("BEGIN")
        cur.executemany(sql, list(params_iter))
        conn.commit()

        print("=== Resumen ===")
        print(f"Tabla usada: {table}")
        print(f"Filas en Excel (únicas por documento): {len(df)}")
        print(f"Filas actualizadas (rowcount do executemany no es exacto en sqlite): {cur.rowcount}")
        print("Listo.")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
