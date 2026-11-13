"use client";

import { usePathname } from "next/navigation";
import { AdminSkeleton } from "@/components/admin/admin-skeleton";
import { routeTheme } from "@/components/route-theme";

export default function Loading() {
  const theme = routeTheme(usePathname());
  if (theme === "admin") return <AdminSkeleton />;
  return <p role="status" className="py-12 text-center text-muted-foreground">Cargando…</p>;
}
