export const QR_ERROR = "No se pudo cargar el QR. Intenta nuevamente.";
export type ParticipantQrPreview =
  | { ok: true; url: string; image: string }
  | { ok: false; message: string };

export function isQrToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
