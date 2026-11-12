"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="mx-auto max-w-md space-y-5 py-10">
      <h1 className="text-2xl font-bold">No pudimos cargar esta página</h1>
      <p className="text-muted-foreground">Intenta nuevamente. Si el problema continúa, contacta al administrador.</p>
      <Button onClick={reset}>Intentar de nuevo</Button>
    </section>
  );
}
