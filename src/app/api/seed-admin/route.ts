import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import bcrypt from "bcryptjs";

/**
 * POST /api/seed-admin
 * Creates the default admin user if no users exist.
 * Default credentials: admin / admin123
 * This endpoint is only usable when there are no users in the DB.
 */
export async function POST() {
  try {
    const existing = await db.select({ id: users.id }).from(users).limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Ya existen usuarios en el sistema. Use el panel de administración." },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash("admin123", 10);
    const [created] = await db
      .insert(users)
      .values({
        username: "admin",
        password: hashed,
        role: "admin",
        entity: null,
      })
      .returning({ id: users.id, username: users.username, role: users.role });

    return NextResponse.json({
      message: "Usuario admin creado. Cambia la contraseña después de iniciar sesión.",
      user: created,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al crear admin", details: String(error) },
      { status: 500 }
    );
  }
}
