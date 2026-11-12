"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        Actualizar datos
      </Button>
      <span role="status" className="text-sm text-muted-foreground">{pending ? "Actualizando…" : ""}</span>
    </div>
  );
}
