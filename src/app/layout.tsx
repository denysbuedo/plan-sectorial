import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import HeaderUserMenu from "@/components/HeaderUserMenu";

export const metadata: Metadata = {
  title: "Plan Sectorial",
  description: "Sistema de gestión del Plan Sectorial de ETECSA para estudiantes universitarios",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  universidad: "Universidad",
  etecsa: "ETECSA",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50">
        <header className="bg-blue-800 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span className="text-blue-800 font-bold text-xs">PS</span>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Plan de Datos Sectorial</h1>
                <p className="text-blue-200 text-xs">Plan de Datos Adicional para Estudiantes Universitarios</p>
              </div>
            </div>

            {session && (
              <HeaderUserMenu
                username={session.username}
                role={ROLE_LABELS[session.role] || session.role}
                isAdmin={session.role === "admin"}
              />
            )}
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
