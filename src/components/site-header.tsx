import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card">
      <nav aria-label="Navegación principal" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-3 font-bold tracking-tight">
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-primary text-sm text-primary-foreground">QR</span>
          Asistencia
        </Link>
        <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
          Acceso administrativo <span aria-hidden="true" className="ml-2">→</span>
        </Link>
      </nav>
    </header>
  );
}
