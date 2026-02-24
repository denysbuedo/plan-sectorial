# Plan Sectorial ETECSA - Guía de Instalación

## Requisitos Previos

1. **VSCode** - Editor de código instalado
2. **Bun** - Gestor de paquetes y runtime de JavaScript
3. **Git** - Control de versiones (opcional pero recomendado)

---

## Paso 1: Instalar Bun en Windows

Bun es más rápido que npm/yarn y es el package manager del proyecto.

### Opción A: Usando PowerShell (Recomendado)
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Opción B: Usando Winget
```powershell
winget install oven-sh.bun
```

### Opción C: Usando npm
```powershell
npm install -g bun
```

**Verificar instalación:**
```powershell
bun --version
```

---

## Paso 2: Clonar el Proyecto

Si tienes el proyecto en un repositorio Git:
```powershell
git clone <url-del-repositorio>
cd <nombre-del-proyecto>
```

Si estás trabajando directamente con los archivos, simplemente abre la carpeta en VSCode.

---

## Paso 3: Instalar Dependencias

En la terminal de VSCode (Terminal → New Terminal), ejecuta:

```powershell
bun install
```

Esto instalará todas las dependencias del proyecto.

---

## Paso 4: Configurar Variables de Entorno

1. Crea un archivo `.env.local` en la raíz del proyecto
2. Copia el contenido de `.env.example` (si existe) o usa este ejemplo:

```env
# URL de la API de ETECSA (configura según tu entorno)
ETECSA_API_URL=http://192.168.1.100
ETECSA_USERNAME=api.mes
ETECSA_PASSWORD=tu_password_aqui

# Secret para JWT (genera una cadena aleatoria larga)
JWT_SECRET=tu_jwt_secret_muy_largo_y_seguro_aqui
```

---

## Paso 5: Ejecutar las Migraciones de Base de Datos

El proyecto usa Drizzle ORM con SQLite. Para crear las tablas:

```powershell
bun run db:migrate
```

---

## Paso 6: Inicializar Datos Iniciales (Opcional)

### Semillar Universidades
```powershell
curl -X POST http://localhost:3000/api/seed
```

### Crear Usuario Administrador Inicial
```powershell
curl -X POST http://localhost:3000/api/seed-admin
```

Esto creará un usuario admin:
- **Usuario:** `admin`
- **Contraseña:** `admin123`

---

## Paso 7: Iniciar el Servidor de Desarrollo

```powershell
bun run dev
```

El servidor arrancará en: **http://localhost:3000**

---

## Paso 8: Acceder a la Aplicación

1. Abre tu navegador en http://localhost:3000
2. Inicia sesión con las credenciales de admin:
   - Usuario: `admin`
   - Contraseña: `admin123`

---

## Estructura del Proyecto

```
├── src/
│   ├── app/                    # Páginas y rutas de Next.js
│   │   ├── page.tsx            # Página principal
│   │   ├── login/              # Página de login
│   │   ├── admin/users/        # Gestión de usuarios
│   │   └── api/                # Endpoints de API
│   ├── components/             # Componentes React
│   ├── db/                     # Base de datos y esquemas
│   └── lib/                    # Utilidades (ETECSA, auth)
├── .env.local                  # Variables de entorno
├── drizzle.config.ts           # Configuración de Drizzle
└── package.json                # Dependencias
```

---

## Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `bun run dev` | Iniciar servidor de desarrollo |
| `bun run build` | Construir para producción |
| `bun run start` | Iniciar servidor de producción |
| `bun run lint` | Verificar código con ESLint |
| `bun run typecheck` | Verificar tipos TypeScript |
| `bun run db:migrate` | Ejecutar migraciones |

---

## Solución de Problemas

### "bun no se reconoce como comando"
Cierra y reopen VSCode después de instalar Bun, o reinicia tu terminal.

### Error de conexión a la base de datos
Asegúrate de que el archivo `.env.local` esté configurado correctamente.

### Error con ETECSA API
Verifica que las variables `ETECSA_API_URL`, `ETECSA_USERNAME` y `ETECSA_PASSWORD` estén correctas en `.env.local`.

---

## Notas

- El proyecto usa **SQLite** como base de datos (archivo `local.db`)
- La autenticación es basada en **JWT** con cookies seguras
- Hay 3 roles: `admin`, `universidad`, `etecsa`
