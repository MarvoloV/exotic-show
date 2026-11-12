# Registro público por QR

En este MVP, **abrir el enlace QR registra la asistencia automáticamente al cargar JavaScript**. No hay botón de confirmación ni inicio de sesión para el participante. Compartir el enlace o su imagen QR permite que otra persona registre el ingreso en su nombre: es un enlace portador (bearer), no prueba de identidad ni de presencia física. Trátalo como una credencial privada y no lo abras para probar un participante real.

## Qué ocurre al abrirlo

1. `GET /asistencia/[token]`, HEAD y prefetch renderizan una página neutra: no consultan ni modifican participantes.
2. Tras la hidratación, el cliente envía automáticamente `POST /asistencia/[token]/registro` al mismo origen. Sin JavaScript no se registra ingreso; la pantalla pide activarlo o solicitar ayuda al organizador.
3. El servidor valida el token y llama a `recordAttendance`, que ejecuta el RPC `record_attendance`. La función SQL bloquea la fila: si está pendiente, asigna la hora del servidor y estado `ASISTIÓ`; si ya asistió, conserva la hora original.

Ver el QR en el panel o descargar su PNG no abre la URL de asistencia ni activa el registro. Eliminar al participante invalida su enlace; editar nombre o monto conserva token, código y asistencia.

## Resultados visibles

| Estado | Pantalla y efecto |
| --- | --- |
| En curso | «Registrando asistencia…», sin identidad anticipada |
| Nuevo ingreso | «Asistencia registrada», nombre y fecha/hora de ingreso |
| Ingreso previo | «Tu ingreso ya fue registrado», nombre y fecha/hora original |
| Token inválido o inexistente | «Enlace no válido», sin identidad |
| Fallo de red/servicio | «No pudimos confirmar tu asistencia» y **Reintentar registro** |

Un fallo de respuesta no garantiza que la escritura haya fallado. Reintentar consulta/registra de forma idempotente sin duplicar asistencia ni reemplazar la primera hora. Los instantes se almacenan en UTC (`timestamptz`) y la interfaz muestra `America/Lima`.

## Límite del endpoint y privacidad

- Si el POST incluye `Origin`, exige un origen válido idéntico al visible para el navegador: compara esquema de la URL y autoridad de `Host` (incluido puerto), con la URL como respaldo si falta Host. No confía en `X-Forwarded-Host`; esto evita el falso rechazo por normalización interna de Next a `localhost` al navegar por `127.0.0.1`. Un `Origin: null`, malformado o ajeno siempre se rechaza.
- Solo si falta `Origin` se permite el respaldo de `Sec-Fetch-Site: same-origin` o `same-site`. Si llega `Sec-Fetch-Site`, debe tener uno de esos valores incluso con un origen válido. No se habilita CORS; este control no convierte el enlace portador en prueba de identidad.
- El token debe tener exactamente 64 caracteres hexadecimales minúsculos, sin recortes ni normalización. Un resultado válido devuelve solo resultado, nombre y fecha UTC; nunca monto, ID, código ni token en el cuerpo.
- El endpoint responde `200` para registro nuevo/repetido, `404` para token inválido/inexistente, `403` para origen rechazado y `503` para fallo del servicio. GET, HEAD, OPTIONS, PUT, PATCH y DELETE al endpoint devuelven `405` sin mutar, con `Allow: POST`.
- Las respuestas del endpoint conservan `private, no-store`, `no-referrer` y `nosniff`. La cabecera global, los metadatos de la página dinámica no indexable y el fetch de registro usan `strict-origin`: permiten revelar solo el origen (esquema, host y puerto), nunca la ruta ni el token; en una bajada de HTTPS a HTTP no envían referrer. Este cambio busca evitar el `Origin: null` del POST en Safari/iPhone sin relajar el control del servidor; aún falta comprobarlo en un iPhone real. El código de esta funcionalidad no registra URLs ni errores del proveedor. El operador también debe evitar almacenar rutas con tokens en los logs del alojamiento o herramientas de analítica.

## Configuración y verificación pendiente

Sigue el [README principal](../../../README.md) para aplicar **ambas migraciones**, configurar las tres variables públicas y agregar `SUPABASE_SECRET_KEY` con una clave moderna `sb_secret_...` **solo en servidor**. `SUPABASE_SERVICE_ROLE_KEY` ya no se lee: no hay fallback y renombrar un JWT heredado no lo convierte en una clave moderna. El DAL valida la configuración antes de crear el cliente; si falta o es inválida, no llama al RPC y responde con el error genérico del servicio. El DAL privilegiado solo ejecuta el RPC de asistencia; la administración usa sesión/RLS. Nunca expongas esa clave en `NEXT_PUBLIC_*`. Los QR usan el origen canónico `NEXT_PUBLIC_SITE_URL`; un escaneo desde móvil requiere un dominio desplegado accesible, no el localhost del equipo del organizador.

La prueba local `node --test src/lib/attendance.test.mjs` usa página/cliente/route con un DAL simulado. `node --test src/lib/attendance-origin.integration.test.mjs` requiere un build existente y arranca un servidor de producción para probar origen `127.0.0.1` con un token malformado: no acredita una escritura en Supabase. La suite local cubre las tres políticas `strict-origin` y conserva los rechazos de orígenes opacos o ajenos; no demuestra el comportamiento de Safari/iPhone.

Falta ejecutar las migraciones dos veces en un Supabase/PostgreSQL aislado, verificar RLS/grants y probar llamadas simultáneas con un único ingreso/hora original. También falta probar navegador y escaneo físico en HTTPS: apertura automática, ingreso repetido, inválido, error/reintento y ausencia de mutación en GET/prefetch/vista previa/descarga. La bitácora deja pendiente la reverificación independiente del arreglo de origen; no se afirma que haya concluido. Consulta los [bloqueos completos](../../../README.md#verificación-pendiente-antes-de-producción).
