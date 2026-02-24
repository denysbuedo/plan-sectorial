import StudentList from "@/components/StudentList";

export default function Home() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Estudiantes</h2>
        <p className="text-gray-500 text-sm mt-1">
          Administra el registro de estudiantes universitarios en el Plan Sectorial de ETECSA (código 506)
        </p>
      </div>
      <StudentList />
    </div>
  );
}
