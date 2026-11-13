"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="admin-state space-y-4 rounded-2xl border border-border bg-card p-8">
    <h2 className="text-xl font-semibold">No se pudieron cargar los datos administrativos.</h2>
    <p className="text-muted-foreground">Comprueba tu conexión o vuelve a iniciar sesión si tu acceso cambió.</p>
    <div className="flex flex-wrap gap-3">
      <Button onClick={reset}>Volver a intentar</Button>
      <Link href="/login" className={buttonVariants({ variant: "outline" })}>Iniciar sesión</Link>
    </div>
  </div>;
}
