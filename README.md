# Asistencia QR

MVP en español con Next.js App Router, React, TypeScript, Tailwind CSS, componentes locales con convenciones shadcn/ui y Supabase (Auth + PostgreSQL). Implementa panel administrativo, participantes, exportación CSV, QR individuales y registro de asistencia por administradores aprobados. **La implementación local no equivale a una validación en producción:** faltan las pruebas reales de Supabase, navegador y escaneo indicadas al final.

> **Abrir un enlace QR con una sesión de administrador aprobado registra la asistencia automáticamente al cargar JavaScript.** Sin sesión aprobada se solicita acceso. El QR no prueba presencia física ni identidad: protege enlaces, tokens e imágenes QR.

## Inicio local

Requiere Node.js 22 o superior (recomendado: 24 LTS) y npm.

1. Instala las versiones del lockfile con `npm ci`.
2. Crea `.env.local` con las cuatro variables siguientes; no lo subas a Git. El usuario informó haber creado `.env.example`, pero su contenido no se ha inspeccionado ni validado en esta entrega.
3. Aplica las dos migraciones y configura Auth y la aprobación administrativa como se indica abajo.
4. Ejecuta `npm run dev` y abre `http://localhost:3000/login`.
5. Inicia sesión con el correo y la contraseña de una cuenta creada y aprobada por el organizador. El acceso correcto abre **`/admin`**; luego entra a **Participantes**.

| Variable | Uso y valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Origen HTTPS del proyecto, por ejemplo `https://PROJECT.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública **publishable**, con prefijo `sb_publishable_`; no se admiten claves JWT heredadas en esta variable |
| `NEXT_PUBLIC_SITE_URL` | Origen canónico: `http://localhost:3000` en local; origen HTTPS real en producción. Determina las URL de los QR |
| `SUPABASE_SECRET_KEY` | Clave secreta moderna del proyecto, con prefijo `sb_secret_`, **solo en servidor**; el DAL de asistencia la usa para ejecutar `record_attendance`, nunca para administrar participantes |

La validación de las variables públicas rechaza valores ausentes, marcadores de ejemplo y orígenes con credenciales, rutas, consultas o fragmentos. HTTP solo se permite para localhost/loopback. Usa el mismo origen al navegar y configurar el sitio (no alternes `localhost` y `127.0.0.1`). Cambiar variables `NEXT_PUBLIC_*` requiere reiniciar el servidor local o redesplegar.

La clave privada también se valida antes de crear el cliente: se recortan espacios de los extremos y se exige `sb_secret_` seguido de letras, números, guiones o guiones bajos. Se rechazan valores ausentes, marcadores de ejemplo, claves publishable y JWT heredados; un fallo no ejecuta el RPC ni devuelve detalles de configuración al visitante.

**Migración:** crea una clave secreta moderna en la configuración de API de tu proyecto Supabase y configura `SUPABASE_SECRET_KEY` en el servidor local y en cada despliegue autorizado; reinicia o redespliega para aplicarla. `SUPABASE_SERVICE_ROLE_KEY` ya no se lee y no hay fallback heredado: evita mantener dos fuentes de credenciales privilegiadas o enmascarar una configuración moderna inválida. No basta con renombrar la variable de un JWT `service_role`: necesitas una clave `sb_secret_...`. Tras migrar sus consumidores, retira la variable antigua del entorno.

**Nunca pongas `service_role`, claves `sb_secret_`, contraseñas de PostgreSQL ni tokens de participantes en variables `NEXT_PUBLIC_*`.** No se necesita contraseña de base de datos en la aplicación. La portada puede renderizar sin configuración; los flujos de datos/Auth requieren Supabase y la asistencia necesita además la clave privada.

## Supabase: aplicar el esquema

Usa primero un proyecto Supabase aislado para pruebas. Desde su **SQL Editor**, como operador de confianza con permisos de propietario, ejecuta completos estos archivos **en este orden**:

1. [`supabase/migrations/202603130001_attendance_foundation.sql`](supabase/migrations/202603130001_attendance_foundation.sql): tablas, secuencia de códigos `EX001`, tokens aleatorios únicos, restricciones, índices, RLS, permisos y RPC atómico `record_attendance`.
2. [`supabase/migrations/202603130002_admin_dashboard.sql`](supabase/migrations/202603130002_admin_dashboard.sql): RPC `admin_dashboard_metrics` con permisos del usuario (`SECURITY INVOKER`).

Las migraciones no se aplican al iniciar Next.js ni al desplegar en Vercel. No basta con crear tablas manualmente: las políticas, los permisos por columna y las funciones son parte del límite de seguridad. No desactives RLS ni amplíes permisos para solucionar errores de acceso.

La administración usa la sesión del usuario aprobado. La clave privilegiada queda confinada al DAL de asistencia: la migración revoca acceso directo a las tablas para `service_role` y concede a ese rol la ejecución de `record_attendance`. Esta función bloquea la fila (`FOR UPDATE`), registra la hora del servidor o devuelve la original. Las fechas representan instantes UTC y se presentan en `America/Lima`.

**Pendiente:** ejecutar ambas migraciones y repetir su aplicación en el entorno aislado, comprobar los permisos/RLS efectivos y demostrar concurrencia real; la inspección SQL y las pruebas simuladas no prueban su ejecución en Supabase.

## Supabase: correo, contraseña y administradores

**Solo cuentas creadas manualmente y aprobadas. No hay registro público ni recuperación de contraseña en este MVP.** No se envían enlaces de acceso, invitación ni recuperación desde la aplicación.

1. En Supabase Dashboard, **Authentication → Providers → Email**, habilita el acceso por correo/contraseña. En la configuración de Auth, deshabilita **Allow new users to sign up** (el nombre puede variar según la versión del Dashboard). Ocultar un formulario no sustituye este ajuste del proveedor.
2. Configura **Site URL** con el origen canónico del entorno. No necesitas callbacks ni plantillas de Magic Link para este acceso. Retira las entradas antiguas `/auth/confirm` de **Redirect URLs** si ya no tienen otros consumidores.
3. En **Authentication → Users → Add user → Create new user**, crea la cuenta con correo y una contraseña fuerte y única; marca **Auto Confirm User** para provisionarla confirmada. No uses **Send invitation**: el MVP no procesa invitaciones. Para cuentas existentes, verifica que tengan correo confirmado y una contraseña ya establecida antes de habilitarles este flujo. Entrega las credenciales por un canal seguro, nunca en el repositorio, variables públicas o logs. Copia el UUID del usuario.
4. Después de aplicar la migración inicial, el operador agrega ese UUID a la lista de aprobación mediante SQL Editor. Sustituye el marcador por el UUID real de `auth.users`:

   ```sql
   insert into public.approved_administrators (user_id)
   values ('UUID_DEL_USUARIO_AUTH'::uuid)
   on conflict (user_id) do nothing;
   ```

   Esta operación es exclusiva del operador; no se puede autoaprobar desde el navegador ni mediante metadatos de Auth. Tener sesión o conocer una contraseña no basta para ser administrador.
5. En `/login`, ingresa correo y contraseña. El servidor valida el correo y exige una contraseña no vacía (sin recortarla), llama a `signInWithPassword` con el cliente SSR y conserva sus cookies de sesión. El éxito redirige a `/admin`, donde se comprueba la aprobación de forma independiente. La pantalla de una sesión aprobada también ofrece **Abrir panel administrativo**; una cuenta no aprobada no obtiene acceso.
6. Si se pierde una contraseña, contacta al organizador: el operador debe verificar la identidad y gestionar las credenciales con las herramientas administrativas de Supabase, fuera de esta aplicación. No hay autoservicio de registro, recuperación ni cambio de contraseña en la aplicación. Revisa las políticas de contraseña y los límites de intentos de Supabase antes de producción.

Los fallos de validación, credenciales, confirmación, proveedor o configuración muestran el mismo mensaje: «No se pudo iniciar sesión. Revisa tus credenciales o contacta al administrador.» No se devuelven ni registran contraseñas, tokens o errores del proveedor.

**Migración desde Magic Link:** `/auth/confirm` queda retirado. Cualquier petición GET vuelve a `/login` con `303` y `Cache-Control: no-store`; ignora códigos, hashes, tipos y destinos, sin verificar enlaces, crear sesión ni escribir cookies. Los correos antiguos ya no sirven para entrar. Provisiona una contraseña para cada cuenta existente antes de cambiar el acceso; su aprobación por UUID se mantiene.

En la navegación del panel autenticado, **Cerrar sesión** finaliza la sesión actual de este navegador con `signOut({ scope: "local" })` de Supabase SSR, elimina sus cookies mediante el cliente de servidor y redirige únicamente a `/login`. No cierra otras sesiones del usuario. El botón se deshabilita mientras procesa; ante un fallo muestra «No se pudo cerrar sesión. Inténtalo de nuevo.», sin detalles del proveedor ni una confirmación falsa de salida.

Proxy renueva cookies y protege `/admin/:path*`; layout, acciones (incluido cerrar sesión), rutas de descarga y DAL vuelven a verificar identidad y aprobación. RLS también protege llamadas directas a la API. Un usuario autenticado sin aprobación no puede administrar participantes.

## Flujos implementados

| Ruta | Funcionalidad |
| --- | --- |
| `/admin` | Totales globales de registrados, asistentes, pendientes, pagos y porcentaje de asistencia |
| `/admin/participants` | Alta en diálogo, edición de nombre/monto, eliminación confirmada, búsqueda por nombre/código, pestañas por estado y páginas de 20 filas; sin selectores de orden |
| `/admin/participants/export` | CSV de todas las coincidencias, no solo la página; excluye tokens, enlaces y QR |
| `/admin/participants/[id]/qr` | Descarga PNG privada; **Ver QR** muestra imagen y enlace personal previa autorización |
| `/asistencia/[token]` | Página para administradores aprobados que envía un POST automático tras hidratar: confirma ingreso, muestra ingreso previo o error |

Código y token se asignan en la base de datos al crear al participante; el PNG se genera localmente bajo demanda, no se almacena ni usa un proveedor externo. Editar conserva código, token y asistencia. Eliminar invalida el QR. Las mutaciones actualizan listado/resumen sin recarga manual; **Actualizar datos** permite consultar cambios externos, sin suscripción en tiempo real. Los montos no tienen moneda asignada; el total de pagos es la suma de montos, no un historial de transacciones.

La tabla general omite deliberadamente token y enlace: se accede al enlace mediante **Ver QR**. La exportación es CSV, no XLSX. Detalles: [administración](src/app/admin/README.md) y [asistencia](src/app/asistencia/README.md).

## Desplegar en Vercel

1. Importa el repositorio como proyecto Next.js y selecciona Node.js 24 LTS. Comando de build: `npm run build`; no aplica migraciones.
2. Configura **las cuatro variables** de la tabla para cada entorno autorizado. `NEXT_PUBLIC_SITE_URL` debe ser el origen HTTPS estable que usarán los QR. Mantén `SUPABASE_SECRET_KEY` solo en el servidor del despliegue, nunca como variable `NEXT_PUBLIC_*`.
3. Usa un proyecto Supabase separado para pruebas/previews; no entregues claves privilegiadas ni datos de producción a previews no confiables. Configura Auth sin registro público y provisiona cuentas de prueba con contraseña y aprobación independiente; este login no requiere SMTP ni callback.
4. Aplica las migraciones en el proyecto correcto y provisiona las cuentas/aprobaciones. Despliega y realiza las verificaciones en vivo siguientes antes de habilitar el evento. Redespliega si cambias variables públicas.
5. No cambies el dominio canónico después de distribuir QR sin planificar los enlaces existentes: las imágenes ya entregadas conservan la URL anterior. Configura los logs del alojamiento para evitar registrar rutas con tokens; no agregues analítica a estos enlaces.

## Estructura y comprobaciones locales

- `src/app/`: páginas, Server Actions, callback retirado y endpoints; estados de carga/error.
- `src/components/`: formularios, tabla, modal QR, resultado público y primitivas UI locales con configuración shadcn en `components.json` (no un kit completo).
- `src/lib/dal/`: autorización y servicios server-only; `src/lib/participants/`: validación, filtros y formato; `src/lib/supabase/`: clientes SSR/navegador y aprobación.
- `supabase/migrations/`: esquema, políticas y RPC; `src/lib/*.test.mjs`: pruebas locales con límites simulados, más la integración de origen del servidor de producción.

Comprobaciones disponibles para el operador. Para el cambio a correo/contraseña se ejecutaron las pruebas simuladas, typecheck, lint, build e integración de origen de producción:

```sh
node --test src/lib/security.test.mjs src/lib/admin-dashboard.test.mjs src/lib/participant-crud.test.mjs src/lib/participant-csv.test.mjs src/lib/participant-qr.test.mjs src/lib/attendance.test.mjs
npm run typecheck
npm run lint
npm run build
node --test src/lib/attendance-origin.integration.test.mjs
```

La última prueba requiere un build existente y arranca su propio servidor Next de producción; no necesita un Supabase real y no demuestra registro de asistencia. Para servir manualmente un build usa `npm start`.

## Verificación pendiente antes de producción

Estos son bloqueos de prueba pendiente, no afirmaciones de defectos reproducidos ni comprobaciones realizadas por esta documentación:

- **Supabase/PostgreSQL aislado:** falta un destino configurado para aplicar ambas migraciones dos veces y verificar restricciones, RLS y grants como anónimo, usuario no aprobado, administrador aprobado y `service_role`; demostrar llamadas concurrentes a `record_attendance` con una sola hora original.
- **Datos reales:** comprobar RPC de métricas, búsqueda literal en PostgREST, persistencia CRUD, filtros/orden/paginación, exportación completa y acceso autorizado a QR.
- **Auth y navegador:** probar una cuenta provisionada con contraseña correcta, incorrecta y correo no confirmado; ausencia de registro/recuperación públicos, rechazo de enlaces antiguos, cookies/renovación y denegación sin aprobación; cierre de sesión desde Resumen y Participantes, eliminación de cookies, regreso fijo a `/login` y rechazo al volver a abrir una ruta administrativa sin iniciar sesión; formularios, confirmación de eliminación, descarga CSV/PNG, teclado y diseño móvil/tablet/escritorio. Comprobar que GET/prefetch/vista previa/descarga no registran asistencia y que solo un administrador aprobado puede registrar asistencia al abrir la página con JavaScript.
- **Escaneo físico:** leer un PNG desde un móvil en el dominio HTTPS desplegado; comprobar registro nuevo, repetido con hora original, enlace inválido, error/reintento y presentación en Lima. No se ha realizado esta prueba.
- **Configuración y cierre:** falta versionar una plantilla `.env.example` segura, porque el guard de este entorno impide inspeccionar ese path; la bitácora registra siete vulnerabilidades moderadas de dependencias pendientes de evaluación (no se ejecutó una auditoría nueva). La integración local de producción para el arreglo de origen `127.0.0.1` ya pasó; esto no sustituye la verificación desplegada.

El seguimiento de aceptación S1–S12 y de la elección histórica Magic Link (S13), sustituida por correo/contraseña en L28, está en [`odd/tasks/attendance-qr-mvp.md`](odd/tasks/attendance-qr-mvp.md). No considerar el MVP validado para producción hasta obtener estas pruebas.
