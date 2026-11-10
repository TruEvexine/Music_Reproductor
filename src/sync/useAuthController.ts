import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createAttemptLimiter, SIGN_UP_SENT, signInMessage, signUpMessage } from "../core/authMessages";
import { supabase, supabaseConfigured } from "./supabaseClient";

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

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    void supabase.auth
      .getSession()
      .then(({ data: sessionData, error }) => {
        if (error) throw error;
        if (active) setSession(sessionData.session);
      })
      .catch(() => {
        if (active) {
          setAuthError("No se pudo comprobar la sesión.");
        }
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !session?.user.id || !supabase) {
      if (supabaseConfigured) setDatabaseState("checking");
      return;
    }

    let active = true;
    setDatabaseState("checking");
    setDatabaseError(null);

    void supabase
      .from("profiles")
      .select("id")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ error }) => {
        if (!active) return;
        if (error) {
          setDatabaseState("error");
          setDatabaseError("No se pudo leer tu perfil. Inténtalo más tarde.");
          return;
        }
        setDatabaseState("connected");
      });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return;

    const wait = signInLimiter.waitSeconds();
    if (wait > 0) {
      setAuthError(`Demasiados intentos. Espera ${wait} s y vuelve a probar.`);
      return;
    }
    setIsSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
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
      if (!supabase) return;

      setIsSubmitting(true);
      setAuthError(null);
      setAuthNotice(null);
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
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

  const signOut = useCallback(async () => {
    if (!supabase) return;

    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError("No se pudo cerrar la sesión.");
  }, []);

  const clearAuthMessages = useCallback(() => {
    setAuthError(null);
    setAuthNotice(null);
  }, []);

  return {
    authError,
    authNotice,
    clearAuthMessages,
    databaseError,
    databaseState,
    isConfigured: supabaseConfigured,
    isSubmitting,
    session,
    signIn,
    signOut,
    signUp,
  };
}

export type AuthController = ReturnType<typeof useAuthController>;
