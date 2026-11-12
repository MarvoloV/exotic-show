# QR attendance MVP
Objective: build the requested secure, maintainable Next.js + Supabase attendance system.
Branch: `feat/attendance-qr-mvp`. Delivery strategy: `ask-on-risk`; chain strategy: `feature-branch-chain`. Test runner: `node --test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Specs
1. S1 — “Desarrollar una aplicación web sencilla, moderna, responsive y fácil de administrar que permita registrar participantes, generar automáticamente un código QR único para cada uno y controlar su asistencia mediante el escaneo desde un dispositivo móvil.”
2. S2 — “Frontend: Next.js (App Router), React y TypeScript.” “Estilos: Tailwind CSS y shadcn/ui.” “Backend: API Routes o Server Actions de Next.js.” “Base de datos: PostgreSQL mediante Supabase.” “Despliegue: Vercel.”
3. S3 — “Crear un dashboard” with “Total de participantes registrados”, “Total de participantes que asistieron”, “Total de participantes pendientes”, “Total de pagos registrados” and “Porcentaje de asistencia.”
4. S4 — “El administrador podrá crear, editar y eliminar participantes.” Fields include “Código del participante (generación automática, ejemplo: EX001)”, names, paid amount, default “PENDIENTE”, unique token, attendance link and QR.
5. S5 — The participant list must include the requested columns and “Búsqueda por nombre o código”, filters, sorting, pagination, CSV/Excel export, QR viewing/downloading, and updates without manual full-page reload.
6. S6 — “Cada participante debe tener un código QR único asociado a una URL pública.” Example: “https://mi-dominio.com/asistencia/TOKEN_UNICO”. “El QR debe generarse automáticamente al registrar al participante y poder descargarse como imagen.”
7. S7 — QR attendance: pending attendees must atomically record current server time and become “ASISTIÓ”; existing attendance shows the original time; invalid token shows an error. “Utilizar la zona horaria `America/Lima` para presentar las fechas y horas, almacenándolas en UTC en la base de datos.”
8. S8 — “en esta primera versión, abrir el enlace QR registra la asistencia. Esta funcionalidad debe quedar claramente documentada, ya que un participante podría compartir su enlace con otra persona.”
9. S9 — “Proteger las rutas administrativas mediante autenticación.” “Evitar exponer credenciales de la base de datos.” “Validar los datos tanto en frontend como en backend.” “Evitar registros duplicados de asistencia.” “Aplicar las políticas de acceso necesarias en Supabase.”
10. S10 — “Crear una interfaz moderna, minimalista e intuitiva.” Use shadcn/ui; support mobile, tablet and desktop; make the scanned-QR result especially clear.
11. S11 — Database fields: internal ID, participant code, full name, unique token, paid amount, attendance state/time, created/updated timestamps; “Agregar restricciones e índices para garantizar la unicidad del código y del token.” “Preparar el esquema SQL y las migraciones necesarias.”
12. S12 — “Utilizar componentes reutilizables.” “Separar correctamente lógica de negocio, servicios y componentes visuales.” Include loading/error/confirmation states, typed TypeScript, `.env.example`, Supabase configuration, local and Vercel deployment instructions, and avoid unnecessary dependencies.
13. S13 — Admin access choice: Magic link email through Supabase Auth.

## Tasks
- T1 | S1-S2,S12-S13 | parent | blocked | Foundation is implemented; `.env.example` remains uninspectable by the safety guard. | commit: `003bedc`
- T2 | S9,S11 | parent | blocked | Awaiting isolated PostgreSQL/Supabase migration, RLS and concurrency proof. | commit: `003bedc`
- T3a | S3,S5,S10 | parent | blocked | Awaiting live aggregate RPC, RLS and PostgREST search proof. | commit: `003bedc`
- T3b1 | S4,S9-S10,S12 | parent | blocked | Awaiting live persistence, RLS and browser interaction proof. | commit: `003bedc`
- T3b2 | S5,S9-S10,S12 | parent | blocked | Awaiting live filter, RLS and download proof. | commit: `003bedc`
- T3b3 | S5-S6,S9-S10,S12 | parent | blocked | Awaiting live QR/browser/physical-scan proof. | commit: `003bedc`
- T4 | S6-S8,S10 | parent | blocked | Awaiting live attendance concurrency, browser and physical-scan proof. | commit: `003bedc`
- T5 | S1-S12 | parent | blocked | Awaiting live Supabase/browser authentication and final verification. | commit: `003bedc`

## Log
L1 — User request (verbatim):

creame un proyecto # Proyecto: Sistema de Registro y Control de Asistencia mediante QR

## Objetivo general

Desarrollar una aplicación web sencilla, moderna, responsive y fácil de administrar que permita registrar participantes, generar automáticamente un código QR único para cada uno y controlar su asistencia mediante el escaneo desde un dispositivo móvil.

El sistema debe registrar automáticamente la fecha y hora de ingreso, actualizar el estado del participante y permitir consultar toda la información desde un panel administrativo.

## Stack tecnológico

- **Frontend:** Next.js (App Router), React y TypeScript.
- **Estilos:** Tailwind CSS y shadcn/ui.
- **Backend:** API Routes o Server Actions de Next.js.
- **Base de datos:** PostgreSQL mediante Supabase.
- **Autenticación:** acceso protegido para administradores.
- **QR:** librería para generar códigos QR individuales.
- **Despliegue:** Vercel.

Priorizar una arquitectura sencilla, mantenible y escalable, evitando complejidad innecesaria.

## Módulos principales

### 1. Panel administrativo

Crear un dashboard que permita visualizar:

- Total de participantes registrados.
- Total de participantes que asistieron.
- Total de participantes pendientes.
- Total de pagos registrados.
- Porcentaje de asistencia.

Incluir navegación hacia el registro de participantes y el listado general.

### 2. Registro de participantes

Implementar un formulario con los siguientes campos:

- Código del participante (generación automática, ejemplo: EX001).
- Nombres y apellidos.
- Monto pagado.
- Estado de asistencia (PENDIENTE por defecto).
- Token único generado automáticamente.
- Enlace único de asistencia.
- Código QR generado a partir del enlace.

El administrador podrá crear, editar y eliminar participantes.

El token debe ser aleatorio, seguro y difícil de adivinar.

### 3. Listado de participantes

Implementar una tabla administrativa con las columnas:

| Campo | Descripción |
|---|---|
| Código | Identificador EX001, EX002, etc. |
| Nombres y apellidos | Nombre completo |
| Token | Identificador único |
| Estado | PENDIENTE / ASISTIÓ |
| Fecha de ingreso | Fecha y hora de asistencia |
| Enlace QR | URL individual |
| Pagó | Monto registrado |
| QR | Código QR individual |

Agregar las siguientes funcionalidades:

- Búsqueda por nombre o código.
- Filtros por estado.
- Ordenamiento.
- Paginación.
- Exportación a CSV o Excel.
- Visualización y descarga individual del QR.
- Actualización de datos sin necesidad de recargar manualmente toda la página.

### 4. Generación de QR

Cada participante debe tener un código QR único asociado a una URL pública.

Ejemplo:

`https://mi-dominio.com/asistencia/TOKEN_UNICO`

El QR debe generarse automáticamente al registrar al participante y poder descargarse como imagen.

El enlace debe mantenerse asociado al mismo participante.

### 5. Registro automático de asistencia

Cuando se escanee el QR desde un celular:

1. Abrir una página de validación del participante.
2. Identificar al participante mediante su token.
3. Consultar su información en la base de datos.
4. Verificar si ya tiene asistencia registrada.
5. Si está PENDIENTE, registrar la fecha y hora actual y cambiar su estado a ASISTIÓ.
6. Mostrar una pantalla de confirmación con su nombre.
7. Si ya registró asistencia, mostrar un mensaje indicando que su ingreso ya fue registrado, junto con la fecha y hora original.
8. Si el token es inválido, mostrar una pantalla de error.

El registro debe realizarse en el servidor y ser atómico para evitar duplicados ante múltiples escaneos simultáneos.

Utilizar la zona horaria `America/Lima` para presentar las fechas y horas, almacenándolas en UTC en la base de datos.

**Importante:** en esta primera versión, abrir el enlace QR registra la asistencia. Esta funcionalidad debe quedar claramente documentada, ya que un participante podría compartir su enlace con otra persona.

### 6. Seguridad

- Proteger las rutas administrativas mediante autenticación.
- Evitar exponer credenciales de la base de datos.
- Validar los datos tanto en frontend como en backend.
- Evitar registros duplicados de asistencia.
- Aplicar las políticas de acceso necesarias en Supabase.
- Evitar que un usuario público pueda modificar datos administrativos.
- No colocar tokens o claves privadas en variables públicas del frontend.

### 7. Diseño e interfaz

Crear una interfaz moderna, minimalista e intuitiva.

Utilizar shadcn/ui para tablas, formularios, diálogos, botones, notificaciones y componentes administrativos.

La aplicación debe funcionar correctamente en dispositivos móviles, tablets y computadoras.

La pantalla que se abre al escanear el QR debe ser especialmente sencilla, mostrando claramente si el ingreso se registró correctamente o si ya existía una asistencia.

### 8. Base de datos

Diseñar una estructura que permita almacenar:

- ID interno.
- Código del participante.
- Nombres y apellidos.
- Token único.
- Monto pagado.
- Estado de asistencia.
- Fecha y hora de ingreso.
- Fecha de creación.
- Fecha de actualización.

Agregar restricciones e índices para garantizar la unicidad del código y del token.

Preparar el esquema SQL y las migraciones necesarias.

## Requisitos adicionales

- Utilizar componentes reutilizables.
- Separar correctamente lógica de negocio, servicios y componentes visuales.
- Implementar estados de carga, error y confirmación.
- Incorporar validación de formularios.
- Mantener el código tipado con TypeScript.
- Evitar dependencias innecesarias.
- Agregar un archivo `.env.example`.
- Documentar la configuración de Supabase.
- Incluir instrucciones para ejecutar el proyecto localmente y desplegarlo en Vercel.

## Resultado esperado

Una aplicación web funcional en la que un administrador pueda registrar participantes, consultar su listado, generar y descargar sus códigos QR, y verificar automáticamente las asistencias mediante el escaneo desde celulares.

El sistema debe permitir saber quién asistió, quién está pendiente y la fecha y hora exacta de ingreso.

Implementar primero un MVP completamente funcional, priorizando simplicidad, estabilidad, seguridad y facilidad de mantenimiento.

No agregar funcionalidades complejas que no estén contempladas en los requisitos iniciales.

L2 — User choices (2026-03-13): create `/Users/marvolov/Documents/personal/qr-asistencia`; use Supabase Auth Magic Link by email for administrator access.
L3 — Architecture exploration: use one Next.js App Router application with Supabase SSR/Auth and Postgres; server-only DAL and Server Actions for administrative changes; an atomic row-locking database RPC for public attendance; generated QR images rather than stored blobs. The public attendance page will make an automatic POST after opening, avoiding mutation during GET while preserving the required automatic registration behavior. Source: explorer task `mwd4nhhc-1-44y1`; S1–S13 covered.
L4 — T1 worker completed the Next.js foundation: responsive UI shell, reusable primitives, Supabase SSR factories, Magic Link request/callback, environment validation, and setup docs. `npm install --ignore-scripts`, lint, typecheck, and production build passed (Next.js 16.4.6). `.env.example` remains required but the safety guard blocked its creation. Native assessment classified the candidate medium with no independent verifier; it could not assess untracked files until they are explicitly declared. Seven moderate npm dependency vulnerabilities were reported and remain to be evaluated before closure.
L5 — User states that they manually created `.env.example`. The guard prevents this session from inspecting the sensitive-path file, so its contents remain unverified; T1 stays blocked only for that structural proof while independent T2 proceeds.
L6 — Independent T2 verifier found no reproduced implementation defect. 24 isolated security probes, typecheck, lint, and build passed; actual PostgreSQL/Supabase execution, RLS/grants, migration rerun, and concurrent RPC proof are unavailable because no database tooling or target is configured. Adding the verifier’s regression probes now; T2 cannot close until a real isolated Supabase-compatible database is available for the declared checks.
L7 — The recommended regression probes were added without implementation changes: 24/24 runtime tests plus typecheck, lint, and build passed. A fresh independent verification is running because T2 remains a high-risk security candidate; native assessment is still unavailable for untracked files.
L8 — The independent follow-up verified all six regression probes and the compile-time negative check. T2 remains blocked: no isolated Supabase/PostgreSQL executable or configured target exists to execute the migration twice, validate RLS/grants and test concurrent attendance. This is an unavailable-proof blocker, not a reproduced defect.
L9 — User selected `chain_strategy=feature-branch-chain` for the oversized administration work. Created branch `feat/attendance-qr-mvp`; the administration scope is split into T3a (dashboard/list) and T3b (mutations/export/QR) as chained work units.
L10 — T3a exploration confirms the existing proxy and `requireAdmin` boundary must guard every DAL read. URL parameters require a strict allowlist and literal search serialization; dashboard totals should be global and retain exact monetary decimals. No currency will be inferred because the request specifies only amounts.
L11 — T3a implementation completed with 17 focused tests (41 combined security/admin tests), typecheck, lint and build passing. It is a cohesive 622-line dashboard/list slice including the required aggregate migration, so it exceeds the ~400-line review target; it will remain one bounded chained unit rather than be artificially split across an inseparable UI/DAL/migration/test behavior. Independent high-risk verification is running. Live Supabase execution remains unavailable.
L12 — Independent T3a verification found no reproduced defect; it confirmed local S5 list behavior and structural S10 accessibility. T3a is blocked only on a live Supabase/PostgreSQL target to execute aggregate/RLS/search evidence. The project continues with independent T3b implementation.
L13 — T3b exploration splits the second chained administration slice into CRUD (T3b1), CSV (T3b2), and QR (T3b3). Database defaults already generate immutable codes/tokens; administration must submit only name/payment, and QR links are approved-admin bearer-capability data.
L14 — T3b1 CRUD implementation recorded RED (17 missing-behavior failures) then GREEN (17/17); the combined suite has 58 passing tests with typecheck, lint and build passing. Independent high-risk review is running. Live Supabase RLS and browser interaction remain unavailable proof.
L15 — Independent CRUD verification found no reproduced defect; 4 additional isolated probes passed. T3b1 is blocked only on live Supabase/browser proof. Repository README/admin README contain stale claims that CRUD/dashboard/migrations are absent; reconcile them in the final documentation task. T3b2 begins independently.
L16 — T3b2 CSV implementation recorded RED (11 missing-behavior failures) then GREEN (12/12); 70 combined tests plus typecheck, lint and build pass. It exports all matching participants through an independently authorized private route and excludes token/link/QR data. Independent high-risk verification is running; live Supabase/browser proof remains unavailable.
L17 — Independent CSV verification found no reproduced defect (including 1,203 mocked rows across multiple batch sizes). T3b2 remains blocked only on live Supabase/browser proof. T3b3 begins independently.
L18 — T3b3 QR implementation recorded RED (11 missing-behavior failures) then GREEN (11/11); 81 combined tests, typecheck, lint and build pass. It uses a local QR encoder, canonical origin and private attachment response without activating attendance. Independent high-risk verification is running. npm reports seven moderate dependency vulnerabilities; none were remediated automatically.
L19 — Independent QR verification found no reproduced defect; 4 independent probes passed including PNG-module payload checks. T3b3 remains blocked only on live Supabase/browser/physical-scan proof. T4 begins.
L20 — T4 exploration confirms the public page must render without mutation, then issue an automatic same-origin POST after hydration to the existing server-only atomic RPC. It must never normalize bearer tokens; every result is private/no-store and clearly documents that opening/shared links register attendance.
L21 — T4 implementation recorded RED (10 missing-behavior failures) then GREEN (10/10); 91 combined tests, typecheck, lint and build pass. The cohesive route/UI/docs slice is 412 lines and remains together to preserve its security behavior. Independent high-risk verification is running; live Supabase concurrency/RLS, browser and physical-scan proof remain unavailable.
L22 — Independent production verification reproduced a T4 defect: the registration route compares `Origin` against Next’s normalized `request.url`, rejecting a legitimate `127.0.0.1` browser origin as foreign. The exact production POST should reach invalid-token handling (404) but returned 403. Correct it with a regression test before continuing; existing local pass evidence does not close T4.
L23 — The origin defect was corrected using browser-facing Host plus URL scheme. Its new production integration test failed RED (403) then passed GREEN (404 invalid for legitimate origin); 12 focused tests, typecheck, lint and build pass. Independent re-verification is running.
L24 — Documentation completion: README, admin guide and public attendance guide now describe setup, provisioning, deployed behavior and all live verification gaps. No documentation build/test was applicable; structural whitespace checks passed. T5 remains blocked on unavailable live Supabase/browser/physical-scan proof.
L25 — User authorized configuration migration to the modern Supabase secret API key (`SUPABASE_SECRET_KEY` / `sb_secret_...`) instead of legacy `SUPABASE_SERVICE_ROLE_KEY`. Preserve server-only handling and optionally retain legacy fallback for migration compatibility.
L26 — Modern-secret migration completed: code reads only `SUPABASE_SECRET_KEY`, fails closed for legacy-only configuration, keeps the key server-only, and documents the change. RED had six intended failures; GREEN 38 security tests and 50 security/attendance tests passed with typecheck and lint. No build was run for this configuration-only update.
L27 — Added `MVP.md` at the user’s request: concise Spanish overview of administrator/participant flows, architecture, security limitation and local setup. It does not claim outstanding live verification as complete.
L28 — User decision (verbatim): “hacerlo asi”. Replace Magic Link with manual email/password login for approved administrators; no public registration or password recovery in this MVP.
L29 — Password-login implementation completed: RED 26 intended failures then GREEN 64 security tests; 133 combined tests, typecheck and lint pass. Magic Link callback no longer creates sessions. Independent high-risk verification is running; live Supabase/browser authentication and build proof remain pending.
L30 — Independent password-login verification found no reproduced defect: 134 combined tests, build, typecheck, lint and origin integration pass. Password auth remains blocked only on live Supabase/browser proof; Magic Link S13 is superseded by L28.
L31 — User requested: “que tenga un boton de cerrar sesion”. Add an explicit authenticated-admin sign-out action and control.
L32 — Logout implementation recorded RED (11 failures) then GREEN (77 security tests); typecheck and lint pass. It invokes server-side Supabase sign-out, expires cookies and redirects only to `/login`. Independent high-risk verification is running; live Supabase/browser logout proof remains pending.
