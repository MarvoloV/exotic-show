import { requireAdmin } from "@/lib/dal/admin";
import { getParticipantQr } from "@/lib/dal/participants";
import { attendanceUrl, qrPng } from "@/lib/qr";
import { QR_ERROR } from "@/lib/participants/qr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};
function failure(message: string, status: number) {
  return new Response(message, { status, headers: { ...privateHeaders, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return failure("Acceso administrativo no autorizado.", 403);
  }
  try {
    const { id } = await context.params;
    const participant = await getParticipantQr(id);
    const png = await qrPng(attendanceUrl(participant.token));
    return new Response(new Uint8Array(png), {
      headers: {
        ...privateHeaders,
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="QR-${participant.code}.png"`,
      },
    });
  } catch {
    return failure(QR_ERROR, 500);
  }
}
