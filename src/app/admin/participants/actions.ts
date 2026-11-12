"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal/admin";
import { createParticipant, deleteParticipant, updateParticipant } from "@/lib/dal/participants";
import { INVALID_ID, isParticipantId, MUTATION_ERROR, participantFormInput, singleFormField, validateParticipant, type ParticipantActionState } from "@/lib/participants/validation";

type Operation = "create" | "update" | "delete";

async function mutate(operation: Operation, form: FormData): Promise<ParticipantActionState> {
  try {
    // Actions are callable directly; neither layout protection nor DAL checks
    // replace authorization here, including for malformed submitted fields.
    await requireAdmin();
    const id = operation === "create" ? undefined : singleFormField(form, "id");
    if (operation !== "create" && !isParticipantId(id)) return { status: "error", message: INVALID_ID };
    if (operation === "delete") {
      await deleteParticipant(id);
    } else {
      const result = validateParticipant(participantFormInput(form));
      if (!result.ok) return { status: "error", message: "Revisa los campos indicados.", errors: result.errors };
      if (operation === "create") await createParticipant(result.value);
      else await updateParticipant(id, result.value);
    }
  } catch {
    return { status: "error", message: MUTATION_ERROR };
  }
  // Refresh the current Server Component tree without redirects or changing
  // search parameters. Never invalidate on validation, authorization or DB errors.
  revalidatePath("/admin");
  revalidatePath("/admin/participants");
  return { status: "success", message: operation === "create" ? "Participante registrado." : operation === "update" ? "Participante actualizado." : "Participante eliminado. Su QR ya no es válido." };
}

export async function createParticipantAction(_previous: ParticipantActionState, form: FormData): Promise<ParticipantActionState> {
  return mutate("create", form);
}

export async function updateParticipantAction(_previous: ParticipantActionState, form: FormData): Promise<ParticipantActionState> {
  return mutate("update", form);
}

export async function deleteParticipantAction(_previous: ParticipantActionState, form: FormData): Promise<ParticipantActionState> {
  return mutate("delete", form);
}
