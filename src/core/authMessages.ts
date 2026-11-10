// Mensajes de Auth que no revelan si un correo está registrado, y límite de intentos en cliente.

export const SIGN_IN_FAILED =
  "Correo o contraseña incorrectos. Si acabas de registrarte, confirma tu correo primero.";
export const SIGN_UP_SENT =
  "Si el correo es válido, te enviamos un mensaje para confirmar la cuenta.";
const NETWORK = "No hay conexión con el servidor. Tu música local sigue funcionando.";
const RATE_LIMITED = "Demasiados intentos. Espera un momento y vuelve a probar.";

interface AuthFailure {
  code?: string;
  status?: number;
  name?: string;
}

function common(error: AuthFailure): string | undefined {
  if (error.status === 429 || error.code?.includes("rate_limit")) return RATE_LIMITED;
  if (error.name === "AuthRetryableFetchError" || error.status === 0) return NETWORK;
  return undefined;
}

export function signInMessage(error: unknown): string {
  return common((error ?? {}) as AuthFailure) ?? SIGN_IN_FAILED;
}

/** Devuelve `notice` cuando el fallo debe verse igual que un registro correcto. */
export function signUpMessage(error: unknown): { error?: string; notice?: string } {
  const failure = (error ?? {}) as AuthFailure;
  const shared = common(failure);
  if (shared) return { error: shared };
  if (failure.code === "weak_password") {
    return { error: "La contraseña es demasiado débil. Usa al menos 10 caracteres." };
  }
  if (failure.code === "user_already_exists" || failure.code === "email_exists") {
    return { notice: SIGN_UP_SENT };
  }
  return { error: "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo." };
}

/** Tras `max` fallos seguidos bloquea `lockMs`. Solo frena al usuario honesto; el límite real es del servidor. */
export function createAttemptLimiter(max = 5, lockMs = 30_000) {
  let failures = 0;
  let lockedUntil = 0;
  return {
    /** Segundos restantes de bloqueo (0 = se puede intentar). */
    waitSeconds(now = Date.now()): number {
      return Math.max(0, Math.ceil((lockedUntil - now) / 1000));
    },
    fail(now = Date.now()) {
      failures += 1;
      if (failures >= max) {
        failures = 0;
        lockedUntil = now + lockMs;
      }
    },
    succeed() {
      failures = 0;
      lockedUntil = 0;
    },
  };
}
