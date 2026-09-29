import { useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "./Icon";
import type { AuthController, AuthMode } from "../features/auth/useAuthController";

export function AuthDialog({
  auth,
  onClose,
}: {
  auth: AuthController;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const isRegistration = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRegistration) {
      await auth.signUp(email.trim(), password, displayName.trim());
    } else {
      await auth.signIn(email.trim(), password);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="account-title"
        aria-modal="true"
        className="account-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Cerrar"
          className="icon-button dialog-close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>

        <p className="eyebrow">CUENTA</p>
        <h2 id="account-title">
          {auth.session ? "Tu sesión" : "Conecta tu biblioteca"}
        </h2>

        {!auth.isConfigured ? (
          <div className="setup-notice">
            <p>
              Configura las credenciales públicas de Supabase en el archivo
              local <code>.env</code>:
            </p>
            <code>VITE_SUPABASE_URL</code>
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
            <p>
              Reinicia el servidor de desarrollo después de guardarlas. No
              introduzcas aquí la URI ni la contraseña de PostgreSQL.
            </p>
          </div>
        ) : auth.session ? (
          <div className="account-session">
            <div className="account-identity">
              <span className="account-avatar">
                <Icon name="user" size={21} />
              </span>
              <span>
                <strong>{auth.session.user.email}</strong>
                <small>Sesión activa</small>
              </span>
            </div>
            <p
              className={`connection-state connection-${auth.databaseState}`}
              role="status"
            >
              {auth.databaseState === "checking" && "Comprobando base de datos"}
              {auth.databaseState === "connected" && "Base de datos conectada"}
              {auth.databaseState === "error" && "No se pudo leer el perfil"}
              {auth.databaseState === "not-configured" &&
                "Supabase no está configurado"}
            </p>
            {auth.databaseError && (
              <p className="error-message" role="alert">
                {auth.databaseError}
              </p>
            )}
            {auth.authError && (
              <p className="error-message" role="alert">
                {auth.authError}
              </p>
            )}
            <button
              className="secondary-button"
              onClick={() => void auth.signOut()}
              type="button"
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <>
            <p className="dialog-description">
              Inicia sesión para comprobar el acceso seguro a tu perfil. Tu
              música local no depende de la cuenta.
            </p>
            <form className="auth-form" onSubmit={(event) => void submit(event)}>
              {isRegistration && (
                <label>
                  Nombre
                  <input
                    autoComplete="name"
                    maxLength={80}
                    onChange={(event) => setDisplayName(event.currentTarget.value)}
                    required
                    value={displayName}
                  />
                </label>
              )}
              <label>
                Correo electrónico
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                Contraseña
                <input
                  autoComplete={
                    isRegistration ? "new-password" : "current-password"
                  }
                  minLength={8}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              {auth.authError && (
                <p className="error-message" role="alert">
                  {auth.authError}
                </p>
              )}
              {auth.authNotice && (
                <p className="connection-state" role="status">
                  {auth.authNotice}
                </p>
              )}
              <button
                className="primary-button"
                disabled={auth.isSubmitting}
                type="submit"
              >
                {auth.isSubmitting
                  ? "Conectando…"
                  : isRegistration
                    ? "Crear cuenta"
                    : "Iniciar sesión"}
              </button>
            </form>
            <button
              className="text-button"
              onClick={() => {
                setMode(isRegistration ? "sign-in" : "sign-up");
                auth.clearAuthMessages();
              }}
              type="button"
            >
              {isRegistration
                ? "Ya tengo una cuenta"
                : "Crear una cuenta nueva"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
