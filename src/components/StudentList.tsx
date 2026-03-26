"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import ExcelUpload from "./ExcelUpload";

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
  courseType: string | null;
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

interface StudentListProps {
  userRole: string;
  userEntity: string | null;
  username: string;
}

export default function StudentList({ userRole, userEntity }: StudentListProps) {
  const isAdmin = userRole === "admin";
  const isReadOnly = userRole === "etecsa" || userRole === "universidad";

  const [students, setStudents] = useState<Student[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [filterEntity, setFilterEntity] = useState(userRole === "universidad" && userEntity ? userEntity : "");
  const [filterState, setFilterState] = useState("");
  const [filterHasHolder, setFilterHasHolder] = useState("");
  const [filterIsChannelConfigured, setFilterIsChannelConfigured] = useState("");
  const [filterIsChannelConfirmed, setFilterIsChannelConfirmed] = useState("");
  const [filterIsConfigured, setFilterIsConfigured] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [addForm, setAddForm] = useState({
    docType: "1",
    document: "",
    fullname: "",
    entity: "",
    courseType: "",
  });
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [studentsRefresh, setStudentsRefresh] = useState(0);
  const [unisRefresh, setUnisRefresh] = useState(0);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [stats, setStats] = useState({ active: 0, holders: 0, notRegistered: 0, configured: 0, registered: 0 });
  const limit = 50;

  // Multi-select state
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [bajaLoading, setBajaLoading] = useState(false);
  const [altaLoading, setAltaLoading] = useState(false);
  const [bajaEtecsaLoading, setBajaEtecsaLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  // Entity-level operations (when filter by university is active)
  const [syncingEntity, setSyncingEntity] = useState(false);
  const [altaEntity, setAltaEntity] = useState(false);
  const [bajaEntity, setBajaEntity] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterEntity) params.set("entity", filterEntity);
      if (filterState) params.set("state", filterState);
      if (filterHasHolder) params.set("hasHolder", filterHasHolder);
      if (filterIsChannelConfigured) params.set("isChannelConfigured", filterIsChannelConfigured);
      if (filterIsChannelConfirmed) params.set("isChannelConfirmed", filterIsChannelConfirmed);
      if (filterIsConfigured) params.set("isConfigured", filterIsConfigured);
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      try {
        const res = await fetch(`/api/students?${params.toString()}`);
        if (!res.ok) {
          console.error("API error:", res.status, res.statusText);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setStudents(Array.isArray(data.students) ? data.students : []);
          setTotalStudents(data.pagination?.total || 0);
          setTotalPages(data.pagination?.totalPages || 1);
          setStats(data.stats || { active: 0, holders: 0, configured: 0, registered: 0 });
          setLoading(false);
          setSelectedDocs(new Set());
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filterEntity, filterState, filterHasHolder, filterIsChannelConfigured, filterIsChannelConfirmed, filterIsConfigured, searchQuery, page, studentsRefresh]);

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

  // Register (ALTA) selected students in ETECSA
  const handleAltaSelected = async () => {
    if (selectedDocs.size === 0) return;
    setAltaLoading(true);
    setSyncMsg("");
    const res = await fetch("/api/students/alta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: Array.from(selectedDocs) }),
    });
    const data = await res.json();
    const successCount = data.results?.filter((r: any) => r.status === "registered" || r.status === "registered_pending").length || 0;
    const errorResults = data.results?.filter((r: any) => r.status === "error") || [];
    let msg = `Registrados ${successCount}/${selectedDocs.size} estudiantes en ETECSA`;
    if (errorResults.length > 0) {
      const firstError = errorResults[0];
      msg += ` - Error: ${firstError.message}`;
    }
    setSyncMsg(msg);
    setStudentsRefresh((n) => n + 1);
    setAltaLoading(false);
  };

  // Deregister (BAJA) selected students from ETECSA
  const handleBajaEtecsaSelected = async () => {
    if (selectedDocs.size === 0) return;
    if (!confirm(`¿Dar de baja en ETECSA a ${selectedDocs.size} estudiante(s)? Esto también los marcará como baja en el sistema.`)) return;
    setBajaEtecsaLoading(true);
    setSyncMsg("");
    const res = await fetch("/api/students/baja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: Array.from(selectedDocs), setLocalBaja: true }),
    });
    const data = await res.json();
    const successCount = data.results?.filter((r: any) => r.status === "deregistered").length || 0;
    setSyncMsg(`Dados de baja ${successCount}/${selectedDocs.size} estudiantes en ETECSA`);
    setStudentsRefresh((n) => n + 1);
    setBajaEtecsaLoading(false);
  };

  // Sync all students of a specific entity (university)
  const handleSyncEntity = async () => {
    if (!filterEntity) return;
    const uni = universities.find(u => u.code === filterEntity);
    const uniName = uni?.shortName || uni?.name || filterEntity;
    if (!confirm(`¿Sincronizar TODOS los estudiantes de ${uniName}? Esto puede tomar varios minutos.`)) return;
    setSyncingEntity(true);
    setSyncMsg("");
    const res = await fetch("/api/students/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: filterEntity }),
    });
    const data = await res.json();
    const syncedCount = data.results?.filter((r: any) => r.status === "synced").length || 0;
    const notConfiguredCount = data.results?.filter((r: any) => r.status === "not_configured").length || 0;
    setSyncMsg(`Sincronizados ${syncedCount} estudiantes, ${notConfiguredCount} sin configurar en ETECSA`);
    setStudentsRefresh((n) => n + 1);
    setSyncingEntity(false);
  };

  // Register (ALTA) all students of a specific entity in ETECSA
  const handleAltaEntity = async () => {
    if (!filterEntity) return;
    const uni = universities.find(u => u.code === filterEntity);
    const uniName = uni?.shortName || uni?.name || filterEntity;
    if (!confirm(`¿Registrar en ETECSA TODOS los estudiantes de ${uniName}? Esto puede tomar varios minutos.`)) return;
    setAltaEntity(true);
    setSyncMsg("");
    const res = await fetch("/api/students/alta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: filterEntity }),
    });
    const data = await res.json();
    const successCount = data.results?.filter((r: any) => r.status === "registered" || r.status === "registered_pending").length || 0;
    const totalCount = data.results?.length || 0;
    setSyncMsg(`Registrados ${successCount}/${totalCount} estudiantes de ${uniName} en ETECSA`);
    setStudentsRefresh((n) => n + 1);
    setAltaEntity(false);
  };

  // Deregister (BAJA) all students of a specific entity from ETECSA
  const handleBajaEntity = async () => {
    if (!filterEntity) return;
    const uni = universities.find(u => u.code === filterEntity);
    const uniName = uni?.shortName || uni?.name || filterEntity;
    if (!confirm(`¿Dar de baja en ETECSA a TODOS los estudiantes de ${uniName}? Esto también los marcará como baja en el sistema. Esta acción no se puede deshacer.`)) return;
    setBajaEntity(true);
    setSyncMsg("");
    const res = await fetch("/api/students/baja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: filterEntity, setLocalBaja: true }),
    });
    const data = await res.json();
    const successCount = data.results?.filter((r: any) => r.status === "deregistered").length || 0;
    const totalCount = data.results?.length || 0;
    setSyncMsg(`Dados de baja ${successCount}/${totalCount} estudiantes de ${uniName} en ETECSA`);
    setStudentsRefresh((n) => n + 1);
    setBajaEntity(false);
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
        courseType: addForm.courseType || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAddError(data.error || "Error al agregar estudiante");
    } else {
      setAddSuccess("Estudiante agregado correctamente");
      setAddForm({ docType: "1", document: "", fullname: "", entity: "", courseType: "" });
      setStudentsRefresh((n) => n + 1);
    }
  };

  const handleExportExcel = async () => {
    // Determine which students to export
    let toExport: Student[];
    
    if (selectedDocs.size > 0) {
      // Export selected students
      toExport = students.filter((s) => selectedDocs.has(s.document));
    } else {
      // Export ALL filtered results (not just current page)
      setLoading(true);
      const params = new URLSearchParams();
      if (filterEntity) params.set("entity", filterEntity);
      if (filterState) params.set("state", filterState);
      if (filterHasHolder) params.set("hasHolder", filterHasHolder);
      if (filterIsChannelConfigured) params.set("isChannelConfigured", filterIsChannelConfigured);
      if (filterIsChannelConfirmed) params.set("isChannelConfirmed", filterIsChannelConfirmed);
      if (filterIsConfigured) params.set("isConfigured", filterIsConfigured);
      if (searchQuery) params.set("search", searchQuery);
      // Get all results without pagination
      params.set("limit", "50000");
      const res = await fetch(`/api/students?${params.toString()}`);
      const data = await res.json();
      toExport = data.students || [];
      setLoading(false);
    }

    if (toExport.length === 0) return;

    const rows = toExport.map((s) => ({
      tipo_doc: s.docType,
      documento: s.document,
      nombre_completo: s.fullname,
      entidad: s.entity,
      universidad: s.universityShortName || s.entity,
      estado: STATE_LABELS[s.state]?.label || s.state,
      cliente_etecsa: s.isClient === null ? "" : s.isClient ? "Sí" : "No",
      titular: s.hasMobileSubscriptionsActive === null ? "" : s.hasMobileSubscriptionsActive ? "Sí" : "No",
      registrado_sigenu: s.isChannelConfirmed === null ? "" : s.isChannelConfirmed ? "Sí" : "No",
      registrado_etecsa: s.isChannelConfigured === null ? "" : s.isChannelConfigured ? "Sí" : "No",
      plan_configurado: s.isConfigured === null ? "" : s.isConfigured ? "Sí" : "No",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estudiantes");

    const filename = selectedDocs.size > 0
      ? `estudiantes_seleccionados_${toExport.length}.xlsx`
      : `estudiantes_${filterEntity || "todos"}_${filterState || "todos"}.xlsx`;

    XLSX.writeFile(wb, filename);
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

  // Stats are now computed from the full filtered set (from API)
  // These are kept for compatibility but should use `stats` state instead
  const totalActive = stats.active;
  const holderCount = stats.holders;
  const registeredCount = stats.registered;
  const notRegisteredCount = stats.notRegistered;
  const configuredCount = stats.configured;

  // Delete selected students
  const handleDeleteSelected = async () => {
    if (selectedDocs.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedDocs.size} estudiante(s)? Esta acción no se puede deshacer.`)) return;
    setDeleteLoading(true);
    setSyncMsg("");
    
    let deletedCount = 0;
    for (const doc of selectedDocs) {
      const res = await fetch(`/api/students/${doc}`, { method: "DELETE" });
      if (res.ok) deletedCount++;
    }
    
    setSyncMsg(`Eliminado(s) ${deletedCount} estudiante(s)`);
    setStudentsRefresh((n) => n + 1);
    setDeleteLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: totalStudents, color: "bg-blue-50 border-blue-200 text-blue-800" },
          { label: "Titulares", value: holderCount, color: "bg-green-50 border-green-200 text-green-800" },
          { label: "Habilitados", value: configuredCount, color: "bg-orange-50 border-orange-200 text-orange-800" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-lg border p-4 ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm mt-1 opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {isAdmin && (
            <>
              <button
                onClick={() => { setShowAddForm(!showAddForm); setShowExcelUpload(false); }}
                className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
              >
                {showAddForm ? "Cancelar" : "+ Agregar Estudiante"}
              </button>
              <button
                onClick={() => { setShowExcelUpload(!showExcelUpload); setShowAddForm(false); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                {showExcelUpload ? "Cancelar" : "📥 Importar Excel"}
              </button>
              <button
                onClick={handleSyncAll}
                disabled={syncing || bajaLoading || altaLoading || bajaEtecsaLoading}
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
            </>
          )}
          {isReadOnly && (
            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
              {userRole === "etecsa" ? "👁 Solo lectura" : "👁 Vista de tu universidad"}
            </span>
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
          {isAdmin && (
            <>
              <button
                onClick={handleSyncSelected}
                disabled={syncing || bajaLoading || altaLoading || bajaEtecsaLoading}
                className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50"
              >
                {syncing ? "Sincronizando..." : "↻ Sincronizar seleccionados"}
              </button>
              <button
                onClick={handleAltaSelected}
                disabled={altaLoading || syncing || bajaEtecsaLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {altaLoading ? "Registrando..." : "✓ Registrar en ETECSA"}
              </button>
              <button
                onClick={handleBajaEtecsaSelected}
                disabled={bajaEtecsaLoading || syncing || altaLoading}
                className="px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 transition-colors disabled:opacity-50"
              >
                {bajaEtecsaLoading ? "Dando de baja..." : "✕ Dar de baja en ETECSA"}
              </button>
              <button
                onClick={handleBajaSelected}
                disabled={syncing || bajaLoading || altaLoading || bajaEtecsaLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {bajaLoading ? "Procesando..." : "✕ Solo baja local"}
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deleteLoading || syncing || bajaLoading || altaLoading || bajaEtecsaLoading}
                className="px-4 py-2 bg-red-800 text-white rounded-lg text-sm font-medium hover:bg-red-900 transition-colors disabled:opacity-50"
              >
                {deleteLoading ? "Eliminando..." : "🗑 Eliminar seleccionados"}
              </button>
            </>
          )}
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            📤 Exportar seleccionados
          </button>
          <button
            onClick={() => setSelectedDocs(new Set())}
            className="px-3 py-2 text-sm text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Deseleccionar
          </button>
        </div>
      )}

      {/* Entity-level actions — shown when a university filter is active and no students selected */}
      {isAdmin && filterEntity && !someSelected && (
        <div className="flex flex-wrap gap-3 items-center bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-purple-800">
            Universidad: {universities.find(u => u.code === filterEntity)?.shortName || filterEntity}
          </span>
          <button
            onClick={handleSyncEntity}
            disabled={syncingEntity || syncing || altaLoading || bajaLoading || bajaEtecsaLoading}
            className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            {syncingEntity ? "Sincronizando..." : "🔄 Sincronizar Universidad"}
          </button>
          <button
            onClick={handleAltaEntity}
            disabled={altaEntity || syncing || syncingEntity || bajaLoading || bajaEtecsaLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {altaEntity ? "Registrando..." : "✓ Registrar en ETECSA"}
          </button>
          <button
            onClick={handleBajaEntity}
            disabled={bajaEntity || syncing || syncingEntity || altaLoading || bajaEtecsaLoading}
            className="px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 transition-colors disabled:opacity-50"
          >
            {bajaEntity ? "Dando de baja..." : "✕ Dar de baja en ETECSA"}
          </button>
        </div>
      )}

      {/* Add Student Form — admin only */}
      {isAdmin && showAddForm && (
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Curso</label>
              <select
                value={addForm.courseType}
                onChange={(e) => setAddForm({ ...addForm, courseType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar...</option>
                <option value="Curso Regular Diurno">Curso Regular Diurno</option>
                <option value="Curso Por Encuentro">Curso Por Encuentro</option>
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

      {/* Excel Upload Panel — admin only */}
      {isAdmin && showExcelUpload && (
        <div className="bg-white rounded-lg border border-indigo-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">📥 Importar Estudiantes desde Excel</h2>
          <ExcelUpload onSuccess={() => setStudentsRefresh((n) => n + 1)} />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Nombre, apellido o documento..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filtrar por Universidad</label>
            {userRole === "universidad" ? (
              // Universidad role: locked to their own university
              <div className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 min-w-[200px]">
                {universities.find((u) => u.code === userEntity)?.shortName || userEntity || "—"}
              </div>
            ) : (
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
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filtrar por Estado</label>
            <select
              value={filterState}
              onChange={(e) => { setFilterState(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="baja">Baja</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Titularidad</label>
            <select
              value={filterHasHolder}
              onChange={(e) => { setFilterHasHolder(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">✓ Titular</option>
              <option value="false">✕ No Titular</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Registro SIGENU</label>
            <select
              value={filterIsChannelConfirmed}
              onChange={(e) => { setFilterIsChannelConfirmed(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">✓ Registrado SIGENU</option>
              <option value="false">✕ No Registrado SIGENU</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Habilitado</label>
            <select
              value={filterIsConfigured}
              onChange={(e) => { setFilterIsConfigured(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">✓ Habilitado</option>
              <option value="false">✕ No Habilitado</option>
            </select>
          </div>
          {(filterEntity || filterState || filterHasHolder || filterIsChannelConfigured || filterIsChannelConfirmed || filterIsConfigured || searchQuery) && (
            <button
              onClick={() => { setFilterEntity(""); setFilterState(""); setFilterHasHolder(""); setFilterIsChannelConfigured(""); setFilterIsChannelConfirmed(""); setFilterIsConfigured(""); setSearchQuery(""); setPage(1); }}
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
          <div className="flex items-center gap-3">
            {someSelected && (
              <span className="text-xs text-blue-600 font-medium">
                {selectedDocs.size} seleccionado{selectedDocs.size !== 1 ? "s" : ""}
              </span>
            )}
            {students.length > 0 && (
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors"
                title={someSelected ? "Exportar seleccionados" : "Exportar resultados del filtro"}
              >
                📤 {someSelected ? `Exportar ${selectedDocs.size} seleccionados` : "Exportar resultados"}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Cargando...</div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No hay estudiantes registrados
            {(filterEntity || filterState || searchQuery) && " con los filtros seleccionados"}
          </div>
        ) : (
          <>
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicio</th>
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
                          {student.courseType && (
                            <div className="text-xs text-gray-400">{student.courseType}</div>
                          )}
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
                            <StatusBadge value={student.isClient} label="Cliente" />
                            <StatusBadge value={student.hasMobileSubscriptionsActive} label="Titular" />
                            <StatusBadge value={student.isChannelConfirmed} label="SIGENU" />
                            <StatusBadge value={student.isConfigured} label="Habilitado" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Mostrando {students.length} de {totalStudents} estudiantes
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-600">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
