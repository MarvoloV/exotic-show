import "server-only";

import { toBuffer } from "qrcode";
import { getSiteUrl } from "@/lib/env";
import { isQrToken, QR_ERROR } from "@/lib/participants/qr";

export function attendanceUrl(token: unknown): string {
  if (!isQrToken(token)) throw new Error(QR_ERROR);
  return `${getSiteUrl()}/asistencia/${token}`;
}

export function qrPng(url: string): Promise<Buffer> {
  // Entirely local encoding: no network request to either the URL or a QR service.
  return toBuffer(url, { type: "png", errorCorrectionLevel: "M", margin: 4, width: 320 });
}
