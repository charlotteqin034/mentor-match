/** Central place for environment reads, so missing config fails loudly and once. */

export const env = {
  get supabaseUrl() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  },
  get serviceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  },
  get adminPassword() {
    return process.env.ADMIN_PASSWORD ?? "";
  },
  get sessionSecret() {
    return process.env.ADMIN_SESSION_SECRET ?? "";
  },
  get embeddingsEnabled() {
    return process.env.ENABLE_EMBEDDINGS === "true";
  },
  get huggingFaceKey() {
    return process.env.HUGGINGFACE_API_KEY ?? "";
  },
};

export function supabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.serviceRoleKey);
}

export function missingEnv(): string[] {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.adminPassword) missing.push("ADMIN_PASSWORD");
  if (!env.sessionSecret) missing.push("ADMIN_SESSION_SECRET");
  if (env.embeddingsEnabled && !env.huggingFaceKey) missing.push("HUGGINGFACE_API_KEY");
  return missing;
}
