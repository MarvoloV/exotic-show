import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
      <section>
        <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-primary">Un ingreso más simple</p>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Menos filas.<br />Más encuentros.</h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Una base para organizar participantes y controlar su asistencia mediante QR, desde cualquier dispositivo.
        </p>
        <Link href="/login" className={buttonVariants({ className: "mt-8" })}>Acceder con mi correo <span aria-hidden="true" className="ml-3">→</span></Link>
        <p className="mt-4 text-sm text-muted-foreground">Solo para administradores habilitados. Sin contraseñas.</p>
      </section>
      <Card className="space-y-6">
        <h2 className="text-xl font-semibold">Una experiencia, de principio a fin</h2>
        <ol className="space-y-6">
          {[
            ["01", "Organiza", "Registro y consulta de participantes."],
            ["02", "Comparte", "Un enlace y un código QR por participante."],
            ["03", "Recibe", "Confirmación clara del ingreso desde el celular."],
          ].map(([step, title, description]) => (
            <li key={step} className="flex gap-4">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-sm font-semibold text-primary">{step}</span>
              <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p></div>
            </li>
          ))}
        </ol>
        <p className="border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
          En desarrollo: el panel, los participantes y el registro de asistencia aún no están disponibles.
        </p>
      </Card>
    </div>
  );
}
