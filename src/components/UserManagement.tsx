"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface University {
  code: string;
  name: string;
  shortName: string;
}

interface User {
  id: number;
  username: string;
  role: string;
  entity: string | null;
  createdAt: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  universidad: "Universidad",
  etecsa: "ETECSA",
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    userRole: "universidad",
    entity: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const loadData = () => {
    const doLoad = async () => {
      setLoading(true);
      const [usersRes, unisRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/universities"),
      ]);
      const usersData = await usersRes.json();
      const unisData = await unisRes.json();
      setUsers(Array.isArray(usersData) ? usersData : []);
      setUniversities(Array.isArray(unisData) ? unisData : []);
      setLoading(false);
    };
    doLoad();
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Error al crear usuario");
      return;
    }

    setSuccess("Usuario creado correctamente");
    setForm({ username: "", password: "", userRole: "universidad", entity: "" });
    setShowForm(false);
    loadData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;
    setDeleting(id);

    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSuccess("Usuario eliminado");
      loadData();
    } else {
      const data = await res.json();
      setError(data.error || "Error al eliminar usuario");
    }
    setDeleting(null);
  };

  const getUniversityName = (code: string | null) => {
    if (!code) return "—";
    const uni = universities.find((u) => u.code === code);
    return uni ? uni.shortName : code;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">Administra los usuarios del sistema</p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Volver
        </Link>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
        >
          {showForm ? "Cancelar" : "+ Crear Usuario"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Nuevo Usuario</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Usuario</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Nombre de usuario"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
              <select
                value={form.userRole}
                onChange={(e) => setForm({ ...form, userRole: e.target.value, entity: "" })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="universidad">Universidad</option>
                <option value="etecsa">ETECSA</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {form.userRole === "universidad" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Universidad</label>
                <select
                  value={form.entity}
                  onChange={(e) => setForm({ ...form, entity: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {universities.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.shortName} – {u.code}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
              <button
                type="submit"
                className="px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
              >
                Crear Usuario
              </button>
              {error && <span className="text-sm text-red-600">{error}</span>}
              {success && <span className="text-sm text-green-600">{success}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Usuarios ({users.length})</h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Cargando...</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No hay usuarios</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rol</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Universidad</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{user.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : user.role === "etecsa"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {getUniversityName(user.entity)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={deleting === user.id}
                        className="px-3 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deleting === user.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
