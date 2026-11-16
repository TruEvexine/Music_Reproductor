import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createAttemptLimiter, LINK_SENT, resendMessage, SIGN_UP_SENT, signInMessage, signUpMessage } from "../core/authMessages";
import { emailLink, emailRedirectTo, getSupabase, supabaseConfigured } from "./supabaseClient";
import type { EmailLinkProblem } from "./supabaseClient";

const signInLimiter = createAttemptLimiter();

export type AuthMode = "sign-in" | "sign-up";
export type DatabaseConnectionState =
  | "not-configured"
  | "checking"
  | "connected"
  | "error";

export function useAuthController() {
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [databaseState, setDatabaseState] =
    useState<DatabaseConnectionState>(
      supabaseConfigured ? "checking" : "not-configured",
    );
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [linkProblem, setLinkProblem] = useState<EmailLinkProblem | null>(null);

  useEffect(() => {
    void emailLink.then(setLinkProblem);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;

    let active = true;
    let unsubscribe = () => {};
    void getSupabase()
      .then((supabase) => {
        if (!active) return;
        const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession);
        });
        unsubscribe = () => data.subscription.unsubscribe();
        return supabase.auth.getSession().then(({ data: sessionData, error }) => {
          if (error) throw error;
          if (active) setSession(sessionData.session);
        });
      })
      .catch(() => {
        if (active) {
          setAuthError("No se pudo comprobar la sesión.");
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !session?.user.id) {
      if (supabaseConfigured) setDatabaseState("checking");
      return;
    }

    let active = true;
    setDatabaseState("checking");
    setDatabaseError(null);

    const userId = session.user.id;
    void getSupabase()
      .then((supabase) => supabase.from("profiles").select("id").eq("id", userId).maybeSingle())
      .then(({ error }) => {
        if (error) throw error;
        if (active) setDatabaseState("connected");
      })
      .catch(() => {
        if (!active) return;
        setDatabaseState("error");
        setDatabaseError("No se pudo leer tu perfil. Inténtalo más tarde.");
      });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabaseConfigured) return;

    const wait = signInLimiter.waitSeconds();
    if (wait > 0) {
      setAuthError(`Demasiados intentos. Espera ${wait} s y vuelve a probar.`);
      return;
    }
    setIsSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const { error } = await (await getSupabase()).auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      signInLimiter.succeed();
    } catch (error: unknown) {
      signInLimiter.fail();
      setAuthError(signInMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      if (!supabaseConfigured) return;

      setIsSubmitting(true);
      setAuthError(null);
      setAuthNotice(null);
      try {
        const { data, error } = await (await getSupabase()).auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName }, emailRedirectTo: emailRedirectTo() },
        });
        if (error) throw error;
        if (!data.session) setAuthNotice(SIGN_UP_SENT);
      } catch (error: unknown) {
        const message = signUpMessage(error);
        setAuthError(message.error ?? null);
        setAuthNotice(message.notice ?? null);
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  /** Enlace de confirmación nuevo, pedido desde este navegador (con PKCE solo funcionará aquí). Mismo aviso exista o no la cuenta. */
  const resendLink = useCallback(async (email: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const { error } = await (await getSupabase()).auth.resend({ type: "signup", email, options: { emailRedirectTo: emailRedirectTo() } });
      if (error) throw error;
      setAuthNotice(LINK_SENT);
    } catch (error: unknown) {
      const message = resendMessage(error);
      setAuthError(message.error ?? null);
      setAuthNotice(message.notice ?? null);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseConfigured) return;

    setAuthError(null);
    const { error } = await getSupabase()
      .then((supabase) => supabase.auth.signOut())
      .catch((failure: unknown) => ({ error: failure }));
    if (error) setAuthError("No se pudo cerrar la sesión.");
  }, []);

  const clearAuthMessages = useCallback(() => {
    setAuthError(null);
    setAuthNotice(null);
  }, []);
  const clearLinkProblem = useCallback(() => setLinkProblem(null), []);

  return {
    authError,
    authNotice,
    clearAuthMessages,
    clearLinkProblem,
    databaseError,
    databaseState,
    isConfigured: supabaseConfigured,
    isSubmitting,
    linkProblem,
    resendLink,
    session,
    signIn,
    signOut,
    signUp,
  };
}

export type AuthController = ReturnType<typeof useAuthController>;
