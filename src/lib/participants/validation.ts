// Browser-safe validation shared by forms, Server Actions and the DAL.
export type ParticipantFieldErrors = { full_name?: string; paid_amount?: string };
export type ParticipantActionState = {
  status: "idle" | "error" | "success";
  message: string;
  errors?: ParticipantFieldErrors;
};
export const MUTATION_ERROR = "No se pudo completar la operación. Intenta nuevamente.";
export const INVALID_ID = "El identificador del participante no es válido.";

export function isParticipantId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function singleFormField(form: FormData, key: string): FormDataEntryValue | undefined {
  const values = form.getAll(key);
  return values.length === 1 ? values[0] : undefined;
}

export function participantFormInput(form: FormData) {
  return { full_name: singleFormField(form, "full_name"), paid_amount: singleFormField(form, "paid_amount") };
}

export function validateParticipant(input: unknown):
  | { ok: true; value: { full_name: string; paid_amount: number } }
  | { ok: false; errors: ParticipantFieldErrors } {
  const fields = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const name = typeof fields.full_name === "string" ? fields.full_name.trim() : "";
  const amount = typeof fields.paid_amount === "string" || typeof fields.paid_amount === "number" ? String(fields.paid_amount).trim() : "";
  const errors: ParticipantFieldErrors = {};
  // Count Unicode characters as PostgreSQL char_length does, not UTF-16 units.
  if (!name || Array.from(name).length > 200) errors.full_name = "Ingresa un nombre de 1–200 caracteres, sin espacios al inicio o al final.";
  // Check syntax before converting: never round extra fractions or accept exponents.
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) > 9999999999.99) {
    errors.paid_amount = "Ingresa un monto entre 0 y 9999999999.99, con hasta dos decimales (punto decimal).";
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { full_name: name, paid_amount: Number(amount) } };
}
