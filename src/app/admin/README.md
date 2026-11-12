# Administrar participantes y asistencia

Una cuenta autenticada **y aprobada** puede acceder a `/admin` y `/admin/participants`. Proxy, layout, acciones, endpoints y DAL verifican acceso; las consultas usan la sesión del usuario y RLS, nunca el cliente privilegiado. La configuración de Supabase, migraciones, cuentas con correo/contraseña y aprobación por UUID está en el [README principal](../../../README.md).

## Uso del panel

1. Ingresa en `/login` con el correo y la contraseña de tu cuenta creada manualmente por el organizador en Supabase Dashboard, con correo confirmado y UUID aprobado. El éxito abre `/admin`; si ya tienes una sesión aprobada, usa **Abrir panel administrativo**. No hay registro público ni recuperación de contraseña: contacta al organizador si necesitas ayuda. El callback antiguo `/auth/confirm` solo vuelve a `/login`, sin crear sesiones; los enlaces Magic Link ya no dan acceso.
2. En **Resumen**, consulta registrados, asistentes, pendientes, suma de montos pagados y porcentaje de asistencia globales. Los filtros del listado no cambian estas métricas. No hay historial de pagos ni moneda asignada; el agregado conserva el decimal exacto como texto.
3. En **Participantes**, abre **Registrar participante**. Ingresa nombres/apellidos (1–200 caracteres tras recortar espacios de los extremos) y monto de 0 a 9999999999.99, con hasta dos decimales separados por punto. Se valida en cliente y servidor.
4. La base de datos asigna código (`EX001`, etc.), token aleatorio único y estado inicial `PENDIENTE`. **Editar** modifica solo nombre y monto: conserva código, token/QR y asistencia. No hay acción para reiniciar asistencia.
5. **Eliminar** exige **Confirmar eliminación** o permite **Cancelar**. La eliminación es irreversible e invalida el enlace/QR; no es un archivo recuperable.
6. **Cerrar sesión**, visible en la navegación autenticada de Resumen y Participantes, finaliza la sesión actual del navegador y vuelve únicamente a `/login`. Usa Supabase SSR y su adaptador de cookies; no cierra sesiones de otros dispositivos. Mientras procesa, el botón queda deshabilitado. Si falla, muestra «No se pudo cerrar sesión. Inténtalo de nuevo.» sin detalles privados. La acción verifica identidad y aprobación por sí misma; las protecciones de las demás rutas no cambian.

Guardar o eliminar correctamente actualiza listado y resumen sin recarga manual, conservando filtros/orden. Los formularios muestran estado pendiente, éxito y errores. **Actualizar datos** vuelve a consultar cambios externos; no hay suscripción automática en tiempo real. Las fechas se presentan en `America/Lima`.

## Buscar y recorrer el listado

Busca por nombre o código, elige estado y orden, y pulsa **Aplicar filtros**. La búsqueda es literal y no distingue mayúsculas; `%`, `_` y `*` no son comodines. Usa **Anterior / Siguiente** para recorrer páginas de 20 filas. En pantallas pequeñas, desplaza la tabla horizontalmente.

| Parámetro URL | Valores |
| --- | --- |
| `q` | Texto recortado a 200 caracteres |
| `state` | `all`, `pending`, `attended` |
| `sort` | `created_at`, `full_name`, `code`, `paid_amount`, `attended_at` |
| `direction` | `asc`, `desc` |
| `page` | Entero positivo válido |

Los parámetros inválidos usan sus valores predeterminados: sin búsqueda, todos los estados, fecha de registro descendente y página 1. Aplicar filtros vuelve a la primera página; una página fuera del total se ajusta a la última disponible. Los empates se ordenan por ID, los ingresos nulos van al final y el orden del código es textual.

El conteo y las filas son lecturas consecutivas: cambios concurrentes pueden alterar el total entre ambas. Tampoco se promete una instantánea entre páginas o lotes de exportación; usa **Actualizar datos** si el listado cambió durante la consulta.

## Exportar CSV

**Exportar CSV** descarga `participantes.csv` con todas las coincidencias de los filtros y orden aplicados, no solo la página visible. Incluye código, nombres/apellidos, estado, fecha de ingreso en Lima y monto sin moneda. No incluye ID interno, token, enlace ni QR; no genera XLSX.

Las celdas que podrían ejecutarse como fórmulas llevan un apóstrofo de protección. La ruta `/admin/participants/export` vuelve a autorizar la descarga y responde como adjunto privado sin caché. El archivo contiene datos personales: compártelo solo con personal autorizado.

## Ver y descargar QR

- Cada fila ofrece **Ver QR**: abre un modal autorizado con imagen PNG y enlace personal de solo lectura. La tabla general no expone tokens ni enlaces como columnas.
- **Descargar PNG** consulta `/admin/participants/[id]/qr`, vuelve a autorizar y descarga `QR-EX001.png` (según el código) con respuesta privada sin caché.
- La URL es `${NEXT_PUBLIC_SITE_URL}/asistencia/TOKEN`; no deriva de encabezados del visitante. El encoder funciona localmente, sin servicio QR externo. El token se asigna al crear al participante, pero la imagen se genera bajo demanda, no se almacena.
- **Ver o descargar la imagen no registra asistencia. Abrir el enlace o escanearlo y cargar la página con JavaScript sí.** No lo abras para probar un participante real. Compartir el enlace o PNG permite registrar el ingreso en su nombre; no acredita presencia física.

El resultado público confirma un ingreso nuevo, muestra la fecha/hora original si ya existía, o informa un enlace inválido o error recuperable. Consulta el [flujo público](../asistencia/README.md).

## Requisitos y pruebas pendientes

El registro público requiere `SUPABASE_SECRET_KEY` (`sb_secret_...`) únicamente en servidor; la administración sigue usando sesión/RLS y no recibe esa clave. `SUPABASE_SERVICE_ROLE_KEY` ya no se lee ni se usa como fallback. Consulta la migración de credenciales en el [README principal](../../../README.md#inicio-local); nunca configures claves secretas en `NEXT_PUBLIC_*`.

Se necesitan ambas migraciones, en orden: `202603130001_attendance_foundation.sql` y `202603130002_admin_dashboard.sql`, más una cuenta creada en Supabase Dashboard con correo confirmado, contraseña y su UUID en `approved_administrators`. El proveedor Email debe estar habilitado y el registro de usuarios nuevos deshabilitado; no se usan invitaciones ni recuperación pública. Iniciar Next.js o desplegar no aplica SQL. La función de métricas es `SECURITY INVOKER`, verifica aprobación y solo concede ejecución a `authenticated`.

La implementación incluye CRUD, CSV y QR; **todavía falta prueba real** de aplicación/reaplicación de migraciones, RLS/grants, métricas y búsqueda PostgREST, persistencia, permisos de descargas y comportamiento en navegador (incluidos móvil, teclado, confirmaciones y cierre de sesión con bloqueo de acceso administrativo posterior). No se ejecutó Supabase, navegador ni escaneo físico durante esta actualización documental. El [README principal](../../../README.md#verificación-pendiente-antes-de-producción) concentra todos los bloqueos de verificación y configuración.
