import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { getAdministrator } from "@/lib/supabase/administrator";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Acceso administrativo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
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

  return (
    <div className="mx-auto max-w-md">
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Administración</p>
      <Card>
        <h1 className="text-2xl font-bold tracking-tight">{approved ? "Sesión verificada" : "Te damos la bienvenida"}</h1>
        {approved ? (
          <p role="status" className="mt-4 leading-relaxed text-muted-foreground">
            Tu sesión tiene acceso administrativo. <Link href="/admin" className="font-semibold text-primary underline">Abrir panel administrativo</Link>
          </p>
        ) : (
          <>
            <p className="mt-3 leading-relaxed text-muted-foreground">Ingresa con el correo y la contraseña que tu organización habilitó.</p>
            {authenticated && <p role="alert" className="mt-4 text-sm text-destructive">Esta sesión no tiene acceso administrativo. Usa una cuenta habilitada o contacta al administrador.</p>}
            {unavailable && <p role="alert" className="mt-4 rounded-lg bg-muted p-3 text-sm">{unavailable}</p>}
            <LoginForm disabled={Boolean(unavailable)} />
          </>
        )}
      </Card>
      <p className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">Solo cuentas creadas y aprobadas por el organizador. No hay registro público ni recuperación de contraseña; contacta al administrador si necesitas ayuda.</p>
    </div>
  );
}
