"use server";

import { requireAdmin } from "@/lib/dal/admin";
import { getParticipantQr } from "@/lib/dal/participants";
import { attendanceUrl, qrPng } from "@/lib/qr";
import { QR_ERROR, type ParticipantQrPreview } from "@/lib/participants/qr";

export async function getParticipantQrAction(id: unknown): Promise<ParticipantQrPreview> {
  try {
    await requireAdmin();
    const participant = await getParticipantQr(id);
    const url = attendanceUrl(participant.token);
    const image = `data:image/png;base64,${(await qrPng(url)).toString("base64")}`;
    return { ok: true, url, image };
  } catch {
    return { ok: false, message: QR_ERROR };
  }
}
