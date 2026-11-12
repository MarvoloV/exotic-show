import { requireAdmin } from "@/lib/dal/admin";
import { getParticipantsForExport } from "@/lib/dal/participants";
import { participantCsv } from "@/lib/participants/csv";
import type { SearchParams } from "@/lib/participants/query";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};

function failure(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { ...privateHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  // Route handlers do not inherit the admin layout's authorization.
  try {
    await requireAdmin();
  } catch {
    return failure("Acceso administrativo no autorizado.", 403);
  }
  try {
    const search = new URL(request.url).searchParams;
    const params: SearchParams = {};
    for (const key of ["q", "state", "sort", "direction"]) {
      const values = search.getAll(key);
      if (values.length) params[key] = values.length === 1 ? values[0] : values;
    }
    // The DAL independently authorizes and uses its session-scoped client.
    const csv = participantCsv(await getParticipantsForExport(params));
    return new Response(csv, {
      headers: {
        ...privateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="participantes.csv"',
      },
    });
  } catch {
    return failure("No se pudo exportar el listado. Intenta nuevamente.", 500);
  }
}
