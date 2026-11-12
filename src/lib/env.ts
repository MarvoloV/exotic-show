export class EnvironmentError extends Error {
  constructor(variable: string) {
    super(`Configura una variable válida: ${variable}.`);
    this.name = "EnvironmentError";
  }
}

function required(value: string | undefined, name: string) {
  const result = value?.trim();
  if (!result || /REPLACE_ME|your-project/i.test(result)) {
    throw new EnvironmentError(name);
  }
  return result;
}

function origin(value: string | undefined, name: string) {
  const input = required(value, name);
  try {
    const url = new URL(input);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash
    ) {
      throw new Error("Invalid origin");
    }
    return url.origin;
  } catch {
    throw new EnvironmentError(name);
  }
}

// Explicit property access is required for Next.js browser-value substitution.
// Only publishable keys are accepted, never legacy JWTs or private secret keys.
export function getSupabaseEnv() {
  const url = origin(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  const key = required(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new EnvironmentError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return { url, key };
}

// Pure validation only: private environment variables must be read in server-only modules.
export function parseSupabaseSecretKey(value: string | undefined) {
  const key = required(value, "SUPABASE_SECRET_KEY");
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) {
    throw new EnvironmentError("SUPABASE_SECRET_KEY");
  }
  return key;
}

export function getSiteUrl() {
  return origin(process.env.NEXT_PUBLIC_SITE_URL, "NEXT_PUBLIC_SITE_URL");
}
