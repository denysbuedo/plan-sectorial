import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

function getRequestUser(request: NextRequest) {
  return {
    role: request.headers.get("x-user-role") || "",
    userId: parseInt(request.headers.get("x-user-id") || "0"),
  };
}

// PATCH /api/users/[id] — admin only, update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { role } = getRequestUser(request);
  if (role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id);

  try {
    const body = await request.json();
    const { username, password, userRole, entity } = body;

    if (userRole && !["admin", "universidad", "etecsa"].includes(userRole)) {
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

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (username) updates.username = username;
    if (password) updates.password = await bcrypt.hash(password, 10);
    if (userRole) {
      updates.role = userRole;
      updates.entity = userRole === "universidad" ? entity : null;
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        entity: users.entity,
      });

    if (!updated) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    const msg = String(error);
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese nombre" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Error al actualizar usuario", details: msg },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] — admin only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { role, userId: currentUserId } = getRequestUser(request);
  if (role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id);

  if (userId === currentUserId) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propio usuario" },
      { status: 400 }
    );
  }

  try {
    await db.delete(users).where(eq(users.id, userId));
    return NextResponse.json({ message: "Usuario eliminado" });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al eliminar usuario", details: String(error) },
      { status: 500 }
    );
  }
}
