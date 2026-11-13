"use client";

import { usePathname } from "next/navigation";

export function routeTheme(pathname: string | null) {
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return "admin";
  if (pathname === "/login") return "login";
  return undefined;
}

export function RouteTheme() {
  const theme = routeTheme(usePathname());
  return theme ? <span hidden data-route-theme={theme} /> : null;
}
