"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  login,
  registerUser,
  requestPasswordReset,
  confirmPasswordReset,
} from "@/server/auth/service";
import { SESSION_COOKIE, SESSION_TTL_DAYS, revokeSession } from "@/server/auth/session";
import { verifySessionJwt } from "@/server/auth/signing";
import { isAppError } from "@/server/errors";

/**
 * Authentication Server Actions. Each returns a discriminated result the client
 * form can render; unexpected errors are logged server-side and never leak.
 */

export type ActionState =
  | { ok: true; redirectTo?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

const loginSchema = z.object({
  identifier: z.string().min(1, "Enter your email or username."),
  password: z.string().min(1, "Enter your password."),
});

async function clientMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  return { ip, userAgent: h.get("user-agent") };
}

async function setSessionCookie(value: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function loginAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const meta = await clientMeta();
  const tenantId = formData.get("tenantId");
  try {
    const result = await login({
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      ip: meta.ip,
      userAgent: meta.userAgent,
      tenantId: typeof tenantId === "string" && tenantId ? tenantId : undefined,
    });
    await setSessionCookie(result.cookieValue, result.expiresAt);
  } catch (e) {
    if (isAppError(e)) return { ok: false, message: e.userMessage };
    console.error("loginAction failed", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  redirect("/app");
}

const registerSchema = z.object({
  fullName: z.string().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters."),
});

export async function registerAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const meta = await clientMeta();
  try {
    await registerUser({
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      password: parsed.data.password,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  } catch (e) {
    if (isAppError(e)) {
      return { ok: false, message: e.userMessage, fieldErrors: e.details };
    }
    console.error("registerAction failed", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  // Auto sign-in after registration.
  try {
    const result = await login({
      identifier: parsed.data.email,
      password: parsed.data.password,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await setSessionCookie(result.cookieValue, result.expiresAt);
  } catch {
    return { ok: true, redirectTo: "/login" };
  }
  redirect("/app");
}

export async function forgotPasswordAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Enter your email address." };
  try {
    await requestPasswordReset(email);
  } catch (e) {
    console.error("forgotPasswordAction failed", e);
  }
  // Always report success to avoid leaking which emails exist.
  return { ok: true };
}

export async function resetPasswordAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!token) return { ok: false, message: "This reset link is invalid." };
  try {
    await confirmPasswordReset(token, password);
  } catch (e) {
    if (isAppError(e)) return { ok: false, message: e.userMessage };
    console.error("resetPasswordAction failed", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  redirect("/login?reset=1");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (value) {
    const claims = await verifySessionJwt(value);
    if (claims) await revokeSession(claims.sid);
  }
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_TTL_DAYS_VALUE = SESSION_TTL_DAYS;
