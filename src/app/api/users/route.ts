import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

function getRequestUser(request: NextRequest) {
  return {
    role: request.headers.get("x-user-role") || "",
    entity: request.headers.get("x-user-entity") || null,
  };
}

// GET /api/users — admin only
export async function GET(request: NextRequest) {
  const { role } = getRequestUser(request);
  if (role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        entity: users.entity,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(users.username);

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener usuarios", details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/users — admin only, create user
export async function POST(request: NextRequest) {
  const { role } = getRequestUser(request);
  if (role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { username, password, userRole, entity } = body;

    if (!username || !password || !userRole) {
      return NextResponse.json(
        { error: "username, password y role son requeridos" },
        { status: 400 }
      );
    }

    if (!["admin", "universidad", "etecsa"].includes(userRole)) {
      return NextResponse.json(
        { error: "role debe ser: admin, universidad o etecsa" },
        { status: 400 }
      );
    }

    if (userRole === "universidad" && !entity) {
      return NextResponse.json(
        { error: "entity es requerido para el rol universidad" },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);

    const [created] = await db
      .insert(users)
      .values({
        username,
        password: hashed,
        role: userRole,
        entity: userRole === "universidad" ? entity : null,
      })
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        entity: users.entity,
      });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = String(error);
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese nombre" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Error al crear usuario", details: msg },
      { status: 500 }
    );
  }
}
