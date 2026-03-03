# Active Context: Plan Sectorial ETECSA

## Current State

**App Status**: ✅ Plan Sectorial student management system with full ETECSA integration

A full student management system for ETECSA's Plan Sectorial (code 506) for Cuban university students with complete integration to ETECSA API.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] Database schema: `students` + `universities` tables (SQLite via Drizzle ORM)
- [x] API routes: GET/POST `/api/students`, POST `/api/students/sync`, GET `/api/universities`, POST `/api/seed`
- [x] ETECSA API client (`src/lib/etecsa.ts`) with analyze + register functions
- [x] Student list UI with filters by entity (university) and state
- [x] Add student form with validation (docType, document 11 digits, fullname, entity)
- [x] Sync with ETECSA button to update holder/plan status
- [x] Stats dashboard (total, active, holders, configured)
- [x] 23 Cuban universities seeded via `/api/seed`
- [x] Multi-select checkboxes in student table
- [x] "Sincronizar seleccionados" bulk sync action
- [x] "Dar de baja" bulk state change action
- [x] PATCH `/api/students` bulk state update endpoint
- [x] PATCH `/api/students/[document]` single student state update endpoint
- [x] Excel bulk import: `xlsx` library, `POST /api/students/bulk` endpoint, `ExcelUpload` component
- [x] "📥 Importar Excel" button in actions bar, collapsible panel with preview + result
- [x] Excel export: "📤 Exportar" button in table header (exports filtered results) and in bulk actions bar (exports selected students)
- [x] User authentication with 3 roles: admin, universidad, ETECSA
- [x] JWT-based session management with cookies
- [x] Login page (`/login`) with form validation
- [x] Middleware to protect routes and enforce role-based access
- [x] Admin-only user management page (`/admin/users`)
- [x] User CRUD API (`/api/users`, `/api/users/[id]`)
- [x] Role-based UI restrictions: Universidad sees only their university, ETECSA sees all (read-only), admin can do everything
- [x] Seed admin endpoint (`/api/seed-admin`) to create first admin user
- [x] ETECSA API client with JWT authentication (`src/lib/etecsa.ts`)
- [x] ALTA (register) endpoint `POST /api/students/alta`
- [x] BAJA (deregister) endpoint `POST /api/students/baja`
- [x] `.env.example` with ETECSA API configuration
- [x] Support for self-signed TLS certificates (`ETECSA_INSECURE_SKIP_TLS` env var)
- [x] Student deletion (API + UI)
- [x] Password change (API + UI)
- [x] Search bar for students (name, surname, document)
- [x] Pagination for student list (50 per page)
- [x] Better error message in /api/seed when database tables don't exist
- [x] ALTA/BAJA docType format fix - ALTA uses "1"/"2", analyze uses "ID"/"PASSPORT"
- [x] **NEW**: Full student status columns: isClient, hasMobileSubscriptionsActive, isChannelConfirmed, isChannelConfigured, isConfigured
- [x] **NEW**: Updated filters: Titularidad, Registro ETECSA, Registro SIGENU, Plan
- [x] **NEW**: Export all filtered results (not just current page)
- [x] **NEW**: Sync is now read-only - no auto-register during sync, must use ALTA explicitly
- [x] **NEW**: Scheduled tasks API endpoints:
  - POST `/api/scheduled/sync` - Full sync with auto-register for new holders
  - POST `/api/scheduled/retry-alta` - Retry ALTA for unregistered students
  - POST `/api/scheduled/process-files` - Process Excel files from /altas and /bajas folders
- [x] **NEW**: Combined 5 status columns into single "Servicio" column in student table
- [x] **NEW**: Updated stats to show: Total, Registrados ETECSA (isChannelConfigured), Titulares (hasMobileSubscriptionsActive), Plan Configurado (isConfigured)

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page (renders StudentList) | ✅ Ready |
| `src/app/layout.tsx` | Root layout with ETECSA header | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `src/components/StudentList.tsx` | Main student list + filters + add form + ALTA/BAJA buttons | ✅ Ready |
| `src/db/schema.ts` | DB schema: students + universities + users | ✅ Ready |
| `src/db/index.ts` | DB client | ✅ Ready |
| `src/lib/etecsa.ts` | ETECSA API client with JWT auth | ✅ Ready |
| `src/lib/universities.ts` | University codes + names | ✅ Ready |
| `src/components/ExcelUpload.tsx` | Excel file picker, parse, preview, upload | ✅ Ready |
| `src/app/api/students/bulk/route.ts` | POST bulk insert from Excel | ✅ Ready |
| `src/app/api/students/route.ts` | GET (list+filter) + POST (create) + PATCH (bulk state) | ✅ Ready |
| `src/app/api/students/sync/route.ts` | POST sync with ETECSA (read-only, no auto-register) | ✅ Ready |
| `src/app/api/students/alta/route.ts` | POST register students in ETECSA | ✅ Ready |
| `src/app/api/students/baja/route.ts` | POST deregister students from ETECSA | ✅ Ready |
| `src/app/api/universities/route.ts` | GET universities list | ✅ Ready |
| `src/app/api/seed/route.ts` | POST seed universities | ✅ Ready |
| `.env.example` | ETECSA API configuration template | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Database Schema

### `universities`
- `code` (PK): ETECSA entity code (e.g. "50601")
- `name`: Full university name
- `shortName`: Abbreviation (e.g. "UCI")

### `students`
- `document` (PK): 11-digit ID number
- `docType`: 1=CI, 2=Pasaporte
- `fullname`: Full name
- `entity` (FK → universities.code)
- `state`: "active" | "baja" | "error"
- `isHolder`: Has mobile line (from ETECSA)
- `isClient`, `hasMobileSubscriptionsActive`, `isChannelConfirmed`, `isChannelConfigured`, `isConfigured`: ETECSA status fields
- `createdAt`, `updatedAt`

### `users`
- `id` (PK): Auto-increment
- `username`: Unique username
- `password`: bcrypt hash
- `role`: "admin" | "universidad" | "etecsa"
- `entity`: FK to universities.code (only for role=universidad)
- `createdAt`, `updatedAt`

## Tech Dependencies Added

- `xlsx@0.18.5` — Excel parsing (client-side via FileReader + XLSX.read)
- `bcryptjs@3.0.3` — Password hashing
- `jose@6.1.3` — JWT token handling

## ETECSA API Integration

### Authentication
- POST `/auth/v1/` with username/password
- Returns JWT token (expires_in: 1800 seconds)
- All requests require `Authorization: Bearer <token>` header

### Endpoints
- **ALTA (Register)**: POST `/special-segments/v1/MES/` with student data
- **BAJA (Deregister)**: DELETE `/special-segments/v1/MES/` with student data  
- **Analyze**: GET `/special-segments/v1/mes/analyze?document=<>&document_type=<>&subsegment=506`

### Environment Variables
```
ETECSA_API_URL=http://192.168.1.100
ETECSA_USERNAME=api.mes
ETECSA_PASSWORD=mypassword
```

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-02-24 | Built Plan Sectorial ETECSA student management system |
| 2026-02-24 | Added multi-select + bulk sync/baja + Excel bulk import |
| 2026-02-24 | Added user authentication with 3 roles (admin, universidad, ETECSA) |
| 2026-02-24 | Added ALTA/BAJA services with full ETECSA API integration |
| 2026-02-26 | Added better error message in /api/seed when database tables don't exist |
| 2026-03-03 | Fixed ALTA/BAJA docType format: ALTA uses "1"/"2", analyze uses "ID"/"PASSPORT" |
| 2026-03-03 | Updated UI with full student status columns + new filters + export all results |
| 2026-03-03 | Removed auto-register during sync - now separate operations |
| 2026-03-03 | Added scheduled tasks API: /api/scheduled/sync, /api/scheduled/retry-alta, /api/scheduled/process-files |
| 2026-03-03 | Combined status columns into single "Servicio" column + updated stats |
