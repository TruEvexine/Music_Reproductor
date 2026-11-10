import { describe, expect, it } from "vitest";
import { createAttemptLimiter, SIGN_IN_FAILED, SIGN_UP_SENT, signInMessage, signUpMessage } from "./authMessages";

describe("mensajes de Auth", () => {
  it("el inicio de sesión responde igual exista o no el correo", () => {
    const wrongPassword = signInMessage({ code: "invalid_credentials", status: 400 });
    const unconfirmed = signInMessage({ code: "email_not_confirmed", status: 400 });
    const unknown = signInMessage({ code: "user_not_found", status: 400 });
    expect(new Set([wrongPassword, unconfirmed, unknown])).toEqual(new Set([SIGN_IN_FAILED]));
  });

  it("registrar un correo existente se ve como un registro correcto", () => {
    expect(signUpMessage({ code: "user_already_exists" })).toEqual({ notice: SIGN_UP_SENT });
  });

  it("distingue red y límite de peticiones", () => {
    expect(signInMessage({ name: "AuthRetryableFetchError" })).toMatch(/conexión/);
    expect(signInMessage({ status: 429 })).toMatch(/Demasiados/);
  });
});

describe("createAttemptLimiter", () => {
  it("bloquea tras 5 fallos y se libera con el tiempo", () => {
    const limiter = createAttemptLimiter(5, 30_000);
    for (let i = 0; i < 4; i++) limiter.fail(1000);
    expect(limiter.waitSeconds(1000)).toBe(0);
    limiter.fail(1000);
    expect(limiter.waitSeconds(1000)).toBe(30);
    expect(limiter.waitSeconds(31_001)).toBe(0);
  });
});
