"use client";

import { useState, useEffect } from "react";

interface University {
  code: string;
  name: string;
  shortName: string;
}

interface Student {
  document: string;
  docType: number;
  fullname: string;
  entity: string;
  state: string;
  isHolder: boolean | null;
  isClient: boolean | null;
  hasMobileSubscriptionsActive: boolean | null;
  isChannelConfirmed: boolean | null;
  isChannelConfigured: boolean | null;
  isConfigured: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  universityName: string | null;
  universityShortName: string | null;
}

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Activo", color: "bg-green-100 text-green-800" },
  baja: { label: "Baja", color: "bg-red-100 text-red-800" },
  error: { label: "Error", color: "bg-yellow-100 text-yellow-800" },
};

const DOC_TYPE_LABELS: Record<number, string> = {
  1: "CI",
  2: "Pasaporte",
};

function StatusBadge({ value, label }: { value: boolean | null; label: string }) {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
        {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${value ? "text-green-700" : "text-red-600"}`}
    >
      <span
        className={`w-2 h-2 rounded-full inline-block ${value ? "bg-green-500" : "bg-red-400"}`}
      />
      {label}
    </span>
  );
}

export default function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [filterEntity, setFilterEntity] = useState("");
  const [filterState, setFilterState] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    docType: "1",
    document: "",
    fullname: "",
    entity: "",
  });
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [studentsRefresh, setStudentsRefresh] = useState(0);
  const [unisRefresh, setUnisRefresh] = useState(0);

  // Multi-select state
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [bajaLoading, setBajaLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterEntity) params.set("entity", filterEntity);
      if (filterState) params.set("state", filterState);
      const res = await fetch(`/api/students?${params.toString()}`);
      const data = await res.json();
      if (!cancelled) {
        setStudents(Array.isArray(data) ? data : []);
        setLoading(false);
        // Clear selection when list changes
        setSelectedDocs(new Set());
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filterEntity, filterState, studentsRefresh]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/universities");
      const data = await res.json();
      if (!cancelled) setUniversities(Array.isArray(data) ? data : []);
    }
    load();
    return () => { cancelled = true; };
  }, [unisRefresh]);

  const handleSeedUniversities = async () => {
    setSeeding(true);
    await fetch("/api/seed", { method: "POST" });
    setUnisRefresh((n) => n + 1);
    setSeeding(false);
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncMsg("");
    const res = await fetch("/api/students/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setSyncMsg(data.message || "Sincronización completada");
    setStudentsRefresh((n) => n + 1);
    setSyncing(false);
  };

  const handleSyncSelected = async () => {
    if (selectedDocs.size === 0) return;
    setSyncing(true);
    setSyncMsg("");
    const res = await fetch("/api/students/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: Array.from(selectedDocs) }),
    });
    const data = await res.json();
    setSyncMsg(data.message || "Sincronización completada");
    setStudentsRefresh((n) => n + 1);
    setSyncing(false);
  };

  const handleBajaSelected = async () => {
    if (selectedDocs.size === 0) return;
    if (!confirm(`¿Dar de baja a ${selectedDocs.size} estudiante(s)?`)) return;
    setBajaLoading(true);
    setSyncMsg("");
    const res = await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: Array.from(selectedDocs), state: "baja" }),
    });
    const data = await res.json();
    setSyncMsg(data.message || "Baja aplicada");
    setStudentsRefresh((n) => n + 1);
    setBajaLoading(false);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docType: parseInt(addForm.docType),
        document: addForm.document,
        fullname: addForm.fullname,
        entity: addForm.entity,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAddError(data.error || "Error al agregar estudiante");
    } else {
      setAddSuccess("Estudiante agregado correctamente");
      setAddForm({ docType: "1", document: "", fullname: "", entity: "" });
      setStudentsRefresh((n) => n + 1);
    }
  };

  // Selection helpers
  const allVisibleDocs = students.map((s) => s.document);
  const allSelected =
    allVisibleDocs.length > 0 &&
    allVisibleDocs.every((d) => selectedDocs.has(d));
  const someSelected = selectedDocs.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(allVisibleDocs));
    }
  };

  const toggleSelect = (doc: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(doc)) {
        next.delete(doc);
      } else {
        next.add(doc);
      }
      return next;
    });
  };

  const totalStudents = students.length;
  const activeCount = students.filter((s) => s.state === "active").length;
  const holderCount = students.filter((s) => s.isHolder).length;
  const configuredCount = students.filter((s) => s.isConfigured).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Estudiantes", value: totalStudents, color: "bg-blue-50 border-blue-200 text-blue-800" },
          { label: "Activos", value: activeCount, color: "bg-green-50 border-green-200 text-green-800" },
          { label: "Propietarios", value: holderCount, color: "bg-purple-50 border-purple-200 text-purple-800" },
          { label: "Plan Configurado", value: configuredCount, color: "bg-orange-50 border-orange-200 text-orange-800" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-lg border p-4 ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm mt-1 opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
          >
            {showAddForm ? "Cancelar" : "+ Agregar Estudiante"}
          </button>
          <button
            onClick={handleSyncAll}
            disabled={syncing || bajaLoading}
            className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            {syncing && !someSelected ? "Sincronizando..." : "↻ Sincronizar todos"}
          </button>
          {universities.length === 0 && (
            <button
              onClick={handleSeedUniversities}
              disabled={seeding}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {seeding ? "Cargando..." : "Cargar Universidades"}
            </button>
          )}
        </div>
        {syncMsg && (
          <span className="text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
            {syncMsg}
          </span>
        )}
      </div>

      {/* Bulk actions bar — shown when items are selected */}
      {someSelected && (
        <div className="flex flex-wrap gap-3 items-center bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedDocs.size} estudiante{selectedDocs.size !== 1 ? "s" : ""} seleccionado{selectedDocs.size !== 1 ? "s" : ""}
          </span>
          <button
            onClick={handleSyncSelected}
            disabled={syncing || bajaLoading}
            className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : "↻ Sincronizar seleccionados"}
          </button>
          <button
            onClick={handleBajaSelected}
            disabled={syncing || bajaLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {bajaLoading ? "Procesando..." : "✕ Dar de baja"}
          </button>
          <button
            onClick={() => setSelectedDocs(new Set())}
            className="px-3 py-2 text-sm text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Deseleccionar
          </button>
        </div>
      )}

      {/* Add Student Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Agregar Nuevo Estudiante</h2>
          <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Documento</label>
              <select
                value={addForm.docType}
                onChange={(e) => setAddForm({ ...addForm, docType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="1">Carné de Identidad</option>
                <option value="2">Pasaporte</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Documento (11 dígitos)</label>
              <input
                type="text"
                value={addForm.document}
                onChange={(e) => setAddForm({ ...addForm, document: e.target.value })}
                placeholder="00000000000"
                maxLength={11}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre Completo</label>
              <input
                type="text"
                value={addForm.fullname}
                onChange={(e) => setAddForm({ ...addForm, fullname: e.target.value })}
                placeholder="Nombre y apellidos"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Universidad</label>
              <select
                value={addForm.entity}
                onChange={(e) => setAddForm({ ...addForm, entity: e.target.value })}
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
            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
              <button
                type="submit"
                className="px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
              >
                Guardar Estudiante
              </button>
              {addError && <span className="text-sm text-red-600">{addError}</span>}
              {addSuccess && <span className="text-sm text-green-600">{addSuccess}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filtrar por Universidad</label>
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
            >
              <option value="">Todas las universidades</option>
              {universities.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.shortName} – {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filtrar por Estado</label>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="baja">Baja</option>
              <option value="error">Error</option>
            </select>
          </div>
          {(filterEntity || filterState) && (
            <button
              onClick={() => { setFilterEntity(""); setFilterState(""); }}
              className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Estudiantes{" "}
            <span className="text-gray-400 font-normal">({totalStudents})</span>
          </h2>
          {someSelected && (
            <span className="text-xs text-blue-600 font-medium">
              {selectedDocs.size} seleccionado{selectedDocs.size !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Cargando...</div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No hay estudiantes registrados
            {(filterEntity || filterState) && " con los filtros seleccionados"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      title="Seleccionar todos"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Documento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Universidad</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ETECSA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((student) => {
                  const stateInfo = STATE_LABELS[student.state] || { label: student.state, color: "bg-gray-100 text-gray-700" };
                  const isSelected = selectedDocs.has(student.document);
                  return (
                    <tr
                      key={student.document}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? "bg-blue-50" : ""}`}
                      onClick={() => toggleSelect(student.document)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(student.document)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-gray-800">{student.document}</div>
                        <div className="text-xs text-gray-400">{DOC_TYPE_LABELS[student.docType] || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{student.fullname}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-700">{student.universityShortName || student.entity}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{student.universityName || ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${stateInfo.color}`}>
                          {stateInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge value={student.isHolder} label="Propietario" />
                          <StatusBadge value={student.isClient} label="Cliente" />
                          <StatusBadge value={student.hasMobileSubscriptionsActive} label="Línea activa" />
                          <StatusBadge value={student.isChannelConfirmed} label="Canal confirmado" />
                          <StatusBadge value={student.isConfigured} label="Plan configurado" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
