import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { getAdministrator } from "@/lib/supabase/administrator";
import { createClient } from "@/lib/supabase/server";
import { isAttendanceToken } from "@/lib/attendance/result";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Acceso administrativo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ attendance_token?: string }> }) {
  const { attendance_token } = await searchParams;
  const attendanceToken = isAttendanceToken(attendance_token) ? attendance_token : undefined;
  let unavailable = "";
  let authenticated = false;
  let approved = false;
  try {
    const supabase = await createClient();
    const administrator = await getAdministrator(supabase);
    authenticated = Boolean(administrator.user);
    approved = administrator.approved;
  } catch {
    unavailable = "El servicio de acceso no está disponible. Contacta al administrador.";
  }

  if (approved && attendanceToken) redirect(`/asistencia/${attendanceToken}`);

  return (
    <div className="login-screen">
      <header className="login-header"><span className="login-brand">The Exotic Show</span><span className="login-protocol">Acceso administrativo</span></header>
      <div className="login-center">
        <div className="login-panel">
          <Card className="login-card">
            <div className="login-card-label">Acceso / Administrador</div>
            <div className="login-welcome"><span>Entrar al panel</span><h1>{approved ? "Sesión verificada" : "Te damos la bienvenida"}</h1></div>
            <div className="login-body">
            {approved ? (
              <p role="status" className="login-description">Tu sesión tiene acceso administrativo. <Link href="/admin" className="login-link">Abrir panel administrativo</Link></p>
            ) : (
              <>
                <p className="login-description">Ingresa con el correo y la contraseña que tu organización habilitó.</p>
                {authenticated && <p role="alert" className="login-error">Esta sesión no tiene acceso administrativo. Usa una cuenta habilitada o contacta al administrador.</p>}
                {unavailable && <p role="alert" className="login-error">{unavailable}</p>}
                <LoginForm disabled={Boolean(unavailable)} attendanceToken={attendanceToken} />
              </>
            )}
            </div>
            <div className="login-notice"><span aria-hidden="true">◇</span><p>Solo cuentas creadas y aprobadas por el organizador. No hay registro público ni recuperación de contraseña; contacta al administrador si necesitas ayuda.</p></div>
          </Card>
        </div>
      </div>
      <footer className="login-footer">The Exotic Show · Acceso administrativo</footer>
    </div>
  );
}
