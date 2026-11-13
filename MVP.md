# MVP — Sistema de Asistencia por QR

Este MVP permite administrar participantes y registrar su asistencia al abrir un enlace QR único.

> Abrir el enlace QR con una sesión de administrador aprobado registra la asistencia automáticamente. Sin esa aprobación no se registra.

## Qué hace

### Administrador

El organizador crea manualmente en Supabase Dashboard una cuenta con correo confirmado y contraseña, y agrega su UUID a `approved_administrators`. El administrador entra en `/login` con esas credenciales; no se usan enlaces por correo.

Después de iniciar sesión, el administrador puede:

- Ver un panel con participantes registrados, asistentes, pendientes, pagos y porcentaje de asistencia.
- Crear participantes con nombre y monto pagado.
- Editar nombre y monto, o eliminar un participante.
- Buscar, filtrar, ordenar y paginar el listado.
- Exportar todos los resultados filtrados a CSV.
- Ver y descargar el QR individual de cada participante.
- Usar **Cerrar sesión** en la navegación del panel para salir de este navegador y volver a `/login`. No cierra sesiones de otros dispositivos; si falla, muestra un error y permite reintentar.

La base de datos genera automáticamente:

- Código: `EX001`, `EX002`, etc.
- Token aleatorio único.
- Estado inicial: `PENDIENTE`.
- Enlace de asistencia: `/asistencia/<token>`.

### Participante

1. Escanea el QR con un celular.
2. Se solicita iniciar sesión si no hay una sesión de administrador aprobado; luego se vuelve al QR.
3. La página envía un POST automático al servidor.
4. El servidor registra la hora en UTC de forma atómica.
5. La pantalla muestra uno de estos resultados:
   - Asistencia registrada.
   - Asistencia ya registrada, con la hora original.
   - Enlace inválido.
   - Error temporal, con opción de reintentar.

Las fechas se presentan en la zona horaria `America/Lima`.

## Seguridad

- Las rutas administrativas requieren una sesión Supabase y pertenecer a `approved_administrators`.
- No existe registro público ni recuperación de contraseña. Las cuentas y los problemas de acceso los gestiona el organizador manualmente en Supabase Dashboard.
- Los tokens QR se consultan solo en el servidor para acciones autorizadas.
- El registro de asistencia requiere un administrador aprobado y no expone la base de datos ni las claves privadas.
- Las asistencias usan una función SQL con bloqueo de fila para evitar duplicados simultáneos.
- CSV y QR se entregan como respuestas privadas, sin caché pública.

## Arquitectura

| Capa | Tecnología |
| --- | --- |
| Interfaz | Next.js, React, TypeScript, Tailwind y componentes locales estilo shadcn/ui |
| Autenticación | Supabase Auth con correo/contraseña y cookies SSR |
| Datos | PostgreSQL de Supabase, RLS y migraciones SQL |
| QR | Generación local de PNG con `qrcode` |
| Despliegue | Vercel |

## Uso local

1. Configurá `.env.local` con las variables indicadas en [README.md](README.md).
2. Aplicá las migraciones de `supabase/migrations/` a tu proyecto Supabase.
3. Deshabilitá el registro de usuarios nuevos en Auth. En Supabase Dashboard → Authentication → Users → Add user → Create new user, creá una cuenta con correo, contraseña fuerte y **Auto Confirm User** (no invitación); agregá su UUID a `approved_administrators`. El paso a paso está en [README.md](README.md#supabase-correo-contraseña-y-administradores).
4. Ejecutá:

   ```bash
   npm run dev
   ```

5. Iniciá sesión con correo y contraseña en `/login`: se abre `/admin`. Registrá un participante.

El callback antiguo `/auth/confirm` solo vuelve a `/login`; ya no intercambia códigos ni verifica enlaces. Si perdés tu contraseña, contactá al organizador: no hay recuperación pública en este MVP.

## Antes de producción

Todavía deben verificarse contra un Supabase real y dispositivos reales: migraciones/RLS, concurrencia, acceso por contraseña/cookies y aprobación independiente, cierre de sesión y bloqueo posterior de rutas administrativas, flujos de navegador, descarga de archivos y escaneo físico del QR. El detalle técnico está en [README.md](README.md).
