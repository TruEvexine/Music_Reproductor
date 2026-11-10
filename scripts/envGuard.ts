// Guardia de build: ninguna variable VITE_* puede llevar un secreto, porque
// todo lo que empieza por VITE_ se incrusta en el JavaScript público.

function jwtRole(value: string): string | undefined {
  const payload = value.split(".")[1];
  if (!value.startsWith("eyJ") || !payload) return undefined;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role;
  } catch {
    return undefined;
  }
}

export function findSecretEnv(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  for (const [name, raw] of Object.entries(env)) {
    if (!name.startsWith("VITE_")) continue;
    const value = raw ?? "";
    if (/SERVICE_ROLE|SECRET/i.test(name)) {
      problems.push(`${name}: el nombre indica un secreto`);
    } else if (/service_role|sb_secret_/i.test(value) || jwtRole(value) === "service_role") {
      problems.push(`${name}: el valor es una clave secreta de Supabase`);
    } else if (/^\s*postgres(ql)?:\/\//i.test(value)) {
      problems.push(`${name}: el valor es una URI de PostgreSQL`);
    }
  }
  return problems;
}

const audioFile = /\.(flac|mp3|m4a|wav|ogg|opus|aac|alac|aiff)$/i;

export function findBundledAudio(fileNames: string[]): string[] {
  return fileNames.filter((name) => audioFile.test(name));
}
