import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plan Sectorial ETECSA",
  description: "Sistema de gestión del Plan Sectorial de ETECSA para estudiantes universitarios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50">
        <header className="bg-blue-800 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span className="text-blue-800 font-bold text-xs">E</span>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Plan Sectorial</h1>
                <p className="text-blue-200 text-xs">Sistema de Gestión ETECSA</p>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
