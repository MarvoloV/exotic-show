export default function AdminLoading() {
  return <div role="status" className="rounded-2xl border border-border bg-card p-8">
    <p className="font-semibold">Cargando datos administrativos…</p>
    <p className="mt-2 text-sm text-muted-foreground">Un momento, estamos consultando la información.</p>
  </div>;
}
