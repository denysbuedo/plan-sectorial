# Documento Técnico - Plan Sectorial ETECSA

## 1. Resumen del Proyecto

**Plan Sectorial ETECSA** es un sistema de gestión de estudiantes universitarios integrado con la API de ETECSA para el programa "Plan Sectorial" (código 506). Permite a las universidades cubanas gestionar los datos de estudiantes que reciben beneficios de conectividad móvil a través del programa.

### Propósito

- Gestionar el registro de estudiantes universitarios en el programa Plan Sectorial
- Sincronizar datos con la API de ETECSA
- Controlar el estado de activación/desactivación de líneas móviles
- Generar reportes y estadísticas

---

## 2. Arquitectura del Sistema

### Stack Tecnológico

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Next.js** | 16.x | Framework React con App Router |
| **React** | 19.x | Biblioteca de UI |
| **TypeScript** | 5.9.x | Tipado estático |
| **Tailwind CSS** | 4.x | Estilos |
| **Drizzle ORM** | - | ORM para SQLite |
| **SQLite** | - | Base de datos embebida |
| **Bun** | Latest | Runtime y package manager |
| **JWT** | - | Autenticación basada en tokens |

### Estructura del Proyecto

```
plan-sectorial/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Página principal (Dashboard)
│   │   ├── login/              # Página de autenticación
│   │   ├── admin/users/        # Gestión de usuarios (solo admin)
│   │   └── api/                # Endpoints REST
│   │       ├── auth/           # Endpoints de autenticación
│   │       │   ├── login/      # POST - Iniciar sesión
│   │       │   ├── logout/     # POST - Cerrar sesión
│   │       │   └── me/         # GET - Datos del usuario actual
│   │       ├── students/       # Gestión de estudiantes
│   │       │   ├── route.ts    # GET (listar) / POST (crear) / PATCH (bulk)
│   │       │   ├── [document]/ # GET/PATCH estudiante individual
│   │       │   ├── alta/       # POST - Registrar en ETECSA
│   │       │   ├── baja/       # POST - Dar de baja en ETECSA
│   │       │   ├── sync/       # POST - Sincronizar con ETECSA
│   │       │   └── bulk/       # POST - Importar desde Excel
│   │       ├── users/          # CRUD de usuarios
│   │       ├── universities/   # Listar universidades
│   │       ├── seed/           # Seed de universidades
│   │       └── seed-admin/     # Crear admin inicial
│   ├── components/             # Componentes React
│   │   ├── StudentList.tsx     # Lista de estudiantes con filtros
│   │   ├── ExcelUpload.tsx     # Importación de Excel
│ HeaderUserMenu.ts   │   ├──x  # Menú de usuario
│   │   └── UserManagement.tsx  # Gestión de usuarios admin
│   ├── db/                     # Capa de datos
│   │   ├── schema.ts           # Esquemas de tablas
│   │   ├── index.ts            # Cliente de base de datos
│   │   ├── migrate.ts          # Script de migraciones
│   │   └── migrations/         # Archivos SQL de migraciones
│   ├── lib/                    # Utilidades
│   │   ├── auth.ts             # Funciones de autenticación
│   │   ├── etecsa.ts          # Cliente de API ETECSA
│   │   └── universities.ts     # Datos de universidades cubanas
│   └── middleware.ts           # Middleware de autenticación
├── drizzle.config.ts           # Configuración Drizzle
├── local.db                    # Base de datos SQLite
└── package.json                # Dependencias
```

---

## 3. Base de Datos

### Esquema de Tablas

#### Tabla: `universities`

Almacena las universidades cubanas registradas en el sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `code` | TEXT (PK) | Código ETECSA (ej: "50601") |
| `name` | TEXT | Nombre completo |
| `shortName` | TEXT | Nombre corto (abreviatura) |

#### Tabla: `students`

Almacena los estudiantes registrados en el Plan Sectorial.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `document` | TEXT (PK) | Número de identidad (11 dígitos) |
| `docType` | INTEGER | 1=CI, 2=Pasaporte |
| `fullname` | TEXT | Nombre completo |
| `entity` | TEXT (FK) | Código de universidad |
| `state` | TEXT | "active", "baja", "error" |
| `isHolder` | INTEGER | ¿Tiene línea móvil? (0/1) |
| `isClient` | INTEGER | ¿Es cliente? (0/1) |
| `hasMobileSubscriptionsActive` | INTEGER | ¿Tiene suscripciones activas? (0/1) |
| `isChannelConfirmed` | INTEGER | ¿Canal confirmado? (0/1) |
| `isChannelConfigured` | INTEGER | ¿Canal configurado? (0/1) |
| `isConfigured` | INTEGER | ¿Está configurado? (0/1) |
| `createdAt` | DATETIME | Fecha de creación |
| `updatedAt` | DATETIME | Fecha de última actualización |

#### Tabla: `users`

Usuarios del sistema de gestión.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER (PK) | ID autoincremental |
| `username` | TEXT | Nombre de usuario (único) |
| `password` | TEXT | Hash bcrypt de la contraseña |
| `role` | TEXT | "admin", "universidad", "etecsa" |
| `entity` | TEXT | Código de universidad (solo para rol=universidad) |
| `createdAt` | DATETIME | Fecha de creación |
| `updatedAt` | DATETIME | Fecha de última actualización |

---

## 4. Servicios Backend (API)

### Autenticación

#### POST `/api/auth/login`
Inicia sesión y retorna cookie JWT.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

#### POST `/api/auth/logout`
Cierra sesión invalidando la cookie JWT.

#### GET `/api/auth/me`
Retorna los datos del usuario autenticado.

### Estudiantes

#### GET `/api/students`
Lista estudiantes con filtros.

**Query Params:**
- `entity` - Filtrar por universidad
- `state` - Filtrar por estado (active/baja/error)
- `search` - Buscar por nombre o documento

#### POST `/api/students`
Crea un nuevo estudiante.

**Request:**
```json
{
  "document": "99010212345",
  "docType": 1,
  "fullname": "Juan Pérez García",
  "entity": "50601"
}
```

#### PATCH `/api/students`
Actualiza estado de múltiples estudiantes (bulk).

**Request:**
```json
{
  "documents": ["99010212345", "99010212346"],
  "state": "baja"
}
```

#### GET `/api/students/[document]`
Obtiene un estudiante específico.

#### PATCH `/api/students/[document]`
Actualiza un estudiante específico.

#### POST `/api/students/alta`
Registra estudiantes en ETECSA (ALTA).

**Request:**
```json
{
  "documents": ["99010212345", "99010212346"]
}
```

#### POST `/api/students/baja`
Da de baja estudiantes en ETECSA (BAJA).

**Request:**
```json
{
  "documents": ["99010212345", "99010212346"]
}
```

#### POST `/api/students/sync`
Sincroniza estudiantes con la API de ETECSA. Actualiza campos de estado.

**Request:**
```json
{
  "documents": ["99010212345"],
  "autoRegister": true
}
```

**Opciones:**
- `autoRegister: true` - Registra automáticamente si no está configurado

#### POST `/api/students/bulk`
Importa estudiantes desde archivo Excel.

**Body:** FormData con archivo `.xlsx`

### Usuarios (solo admin)

#### GET `/api/users`
Lista todos los usuarios.

#### POST `/api/users`
Crea un nuevo usuario.

#### PATCH `/api/users/[id]`
Actualiza un usuario.

#### DELETE `/api/users/[id]`
Elimina un usuario.

### Utilidades

#### GET `/api/universities`
Lista todas las universidades.

#### POST `/api/seed`
Semilla las 23 universidades cubanas.

#### POST `/api/seed-admin`
Crea el usuario admin inicial.

---

## 5. Integración con ETECSA

### API de ETECSA

El sistema se integra con la API REST de ETECSA para gestionar estudiantes en el segmento especial 506.

### Autenticación

**Endpoint:** `POST /auth/v1/`

**Request:**
```json
{
  "username": "api.mes",
  "password": "password"
}
```

**Response:**
```json
{
  "access_token": "jwt_token",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

### Endpoints de Gestión

| Operación | Método | Endpoint |
|-----------|--------|----------|
| Alta (Registrar) | POST | `/special-segments/v1/MES/` |
| Baja (Deregistrar) | DELETE | `/special-segments/v1/MES/` |
| Analizar | GET | `/special-segments/v1/mes/analyze?document=&document_type=&subsegment=506` |

### Variables de Entorno

```env
ETECSA_API_URL=http://192.168.1.100
ETECSA_USERNAME=api.mes
ETECSA_PASSWORD=tu_password
JWT_SECRET=tu_secret_jwt
```

---

## 6. Autenticación y Autorización

### Sistema de Roles

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **admin** | Administrador del sistema | Gestión completa de usuarios y estudiantes |
| **universidad** | Usuario de universidad | Ver/modificar solo estudiantes de su universidad |
| **etecsa** | Usuario de ETECSA | Solo lectura de todos los estudiantes |

### Flujo de Autenticación

1. Usuario envía credenciales a `/api/auth/login`
2. Servidor valida credenciales contra base de datos
3. Genera token JWT con rol y entidad
4. Envía cookie HTTP-only con el token
5. Middleware verifica token en cada request

### Protección de Rutas

- `/admin/users/*` - Solo admin
- `/api/students/alta` - Admin y universidad
- `/api/students/baja` - Admin y universidad
- `/api/users/*` - Solo admin

---

## 7. Funcionalidades UI

### Dashboard Principal

- **Estadísticas:** Total estudiantes, activos, con línea, configurados
- **Filtros:** Por universidad, estado
- **Acciones en masa:** Sincronizar, dar de baja, alta, importar Excel, exportar

### Lista de Estudiantes

- Tabla con paginación
- Checkboxes para selección múltiple
- Botones de acción: Editar, Alta, Baja, Sincronizar
- Búsqueda por nombre o documento
- Exportación a Excel

### Gestión de Usuarios (Admin)

- CRUD de usuarios
- Asignación de roles y entidades

### Importación/Exportación Excel

- Importar desde archivo `.xlsx`
- Preview de datos antes de importar
- Exportar resultados filtrados

---

## 8. Despliegue

### Requisitos del Servidor

- **SO:** Ubuntu 22.04 LTS
- **RAM:** Mínimo 2GB
- **CPU:** 2 cores
- **Espacio:** 10GB SSD

### Arquitectura con HAProxy

```
                    Internet
                        |
                        ▼
              ┌─────────────────┐
              │  HAProxy :443   │  ← SSL/TLS
              │ plansectorial.  │
              │   mes.gob.cu    │
              └────────┬────────┘
                       │
                       ▼
            ┌────────────────────┐
            │  Next.js :3000      │  ← Puerto interno
            └────────────────────┘
```

### Puerto para HAProxy

**El HAProxy debe apuntar al puerto `3000`** donde corre la aplicación Next.js.

### Pasos de Despliegue

1. Clonar repositorio
2. Instalar Bun y dependencias
3. Configurar variables de entorno
4. Ejecutar migraciones
5. Construir aplicación (`bun run build`)
6. Crear servicio systemd
7. Configurar HAProxy con SSL
8. Inicializar datos (seed)

---

## 9. Universidad Cubanas Soportadas

El sistema incluye las 23 universidades cubanas:

| Código | Nombre | Abreviatura |
|--------|--------|--------------|
| 50601 | Universidad de Ciencias Informáticas | UCI |
| 50602 | Universidad de La Habana | UH |
| 50603 | Instituto Superior Politécnico José Antonio Echeverría | ISPPJAE |
| 50604 | Universidad Central de Las Villas | UCLV |
| 50605 | Universidad de Oriente |UO|
| 50606 | Universidad de Camagüey | UC |
| 50607 | Universidad de Ciego de Ávila | UNICA |
| 50608 | Universidad de Cienfuegos | UCF |
| 50609 | Universidad de Granma | UDG |
| 50610 | Universidad de Holguín | UHo |
| 50611 | Universidad de Matanzas | UM |
| 50612 | Universidad de Pinar del Río | UPR |
| 50613 | Universidad de Sancti Spíritus | UNISS |
| 50614 | Universidad de Santiago de Cuba | USC |
| 50615 | Universidad Tecnológica de La Habana | CUJAE |
| 50616 | Universidad Artemisa | UArtemisa |
| 50617 | Universidad de Mayabeque | UMJ |
| 50618 | Universidad del Cine | UNICUME |
| 50619 | Instituto Superior de Arte | ISA |
| 50620 | Instituto Superior de Diseño | ISDI |
| 50621 | Universidad del Turismo | UTUR |
| 50622 | Educación a Distancia | EAD |
| 50699 | Ministerio de Educación Superior | MES |

---

## 10. Mantenimiento

### Comandos Útiles

```bash
# Reiniciar aplicación
sudo systemctl restart plan-sectorial

# Ver logs
sudo journalctl -u plan-sectorial -f

# Reconstruir después de actualizar código
git pull
bun install
bun run build
sudo systemctl restart plan-sectorial

# Backup de base de datos
cp local.db local.db.backup.$(date +%Y%m%d)
```

### Monitoreo

- Verificar estado: `sudo systemctl status plan-sectorial`
- Ver puertos: `sudo netstat -tlnp | grep 3000`
- Ver recursos: `htop` o `top`

---

## 11. Seguridad

### Buenas Prácticas Implementadas

- Contraseñas hasheadas con bcrypt
- Tokens JWT con expiración
- Cookies HTTP-only
- Validación de tipos en API
- Sanitización de inputs

### Recomendaciones

- Cambiar contraseña admin por defecto
- Usar SSL/TLS en producción
- Configurar firewall (solo puertos 443 y 22)
- Mantener actualizado el sistema
- Realizar backups regulares

---

## 12. Licencia y Contacto

**Proyecto:** Plan Sectorial ETECSA  
**Desarrollado para:** Ministerio de Educación Superior de Cuba  
**Technología:** Next.js + Drizzle ORM + SQLite

Para soporte técnico, contactar al equipo de desarrollo.
