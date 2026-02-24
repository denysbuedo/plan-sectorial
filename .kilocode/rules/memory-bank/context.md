# Active Context: Plan Sectorial ETECSA

## Current State

**App Status**: ✅ Plan Sectorial student management system built with bulk Excel import

A full student management system for ETECSA's Plan Sectorial (code 506) for Cuban university students.

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

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page (renders StudentList) | ✅ Ready |
| `src/app/layout.tsx` | Root layout with ETECSA header | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `src/components/StudentList.tsx` | Main student list + filters + add form | ✅ Ready |
| `src/db/schema.ts` | DB schema: students + universities | ✅ Ready |
| `src/db/index.ts` | DB client | ✅ Ready |
| `src/lib/etecsa.ts` | ETECSA API client | ✅ Ready |
| `src/lib/universities.ts` | University codes + names | ✅ Ready |
| `src/components/ExcelUpload.tsx` | Excel file picker, parse, preview, upload | ✅ Ready |
| `src/app/api/students/bulk/route.ts` | POST bulk insert from Excel | ✅ Ready |
| `src/app/api/students/route.ts` | GET (list+filter) + POST (create) + PATCH (bulk state) | ✅ Ready |
| `src/app/api/students/sync/route.ts` | POST sync with ETECSA | ✅ Ready |
| `src/app/api/universities/route.ts` | GET universities list | ✅ Ready |
| `src/app/api/seed/route.ts` | POST seed universities | ✅ Ready |
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

## Tech Dependencies Added

- `xlsx@0.18.5` — Excel parsing (client-side via FileReader + XLSX.read)

## Pending Features (mentioned by user for later)

- [ ] Alta service (register student to ETECSA)
- [ ] Baja service (deregister student from ETECSA)

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-02-24 | Built Plan Sectorial ETECSA student management system |
| 2026-02-24 | Added multi-select + bulk sync/baja + Excel bulk import |
