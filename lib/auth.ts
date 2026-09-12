import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const COOKIE = "pitchline_session";
const secret = () =>
  new TextEncoder().encode(
    process.env.AUTH_SECRET || "pitchline-demo-secret-change-in-prod"
  );

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarInitials: string;
  theme: string;
  /** Serve URL for avatar photo, or null when using initials only. */
  image: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarInitials: user.avatarInitials,
    theme: user.theme,
    image: user.image,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/**
 * Resolve signed-in user. Verifies JWT then refreshes profile fields from DB
 * so Settings edits (name / avatar) show in header without re-login.
 */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = String(payload.id);
    try {
      const row = await prisma.user.findUnique({
        where: { id },
        select: {
          email: true,
          name: true,
          avatarInitials: true,
          theme: true,
          image: true,
        },
      });
      if (row) {
        return {
          id,
          email: row.email,
          name: row.name,
          avatarInitials: row.avatarInitials || "PL",
          theme: row.theme || "system",
          image: row.image || null,
        };
      }
    } catch {
      /* DB briefly unavailable — fall back to JWT claims */
    }
    return {
      id,
      email: String(payload.email),
      name: String(payload.name),
      avatarInitials: String(payload.avatarInitials || "PL"),
      theme: String(payload.theme || "system"),
      image: payload.image ? String(payload.image) : null,
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getSession();
  if (!user) return null;
  return user;
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarInitials: user.avatarInitials,
    theme: user.theme,
    image: user.image || null,
  } satisfies SessionUser;
}
