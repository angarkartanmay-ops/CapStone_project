import jwt from 'jsonwebtoken';
import { User } from './models.js';

const COOKIE = 'sw_token';
const MAX_AGE_S = 60 * 60 * 24 * 7;

export const secret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production');
  return 'spillway-dev-secret-change-me';
};

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch { /* malformed cookie: ignore it */ }
  }
  return out;
}

export function setSession(res, user) {
  const token = jwt.sign({ sub: String(user._id), u: user.username }, secret(), { expiresIn: MAX_AGE_S });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_S * 1000,
  });
}

export const clearSession = (res) => res.clearCookie(COOKIE);

/** Returns the user id from a cookie header, or null. Shared by HTTP and Socket.IO. */
export function userIdFromCookie(header) {
  const token = parseCookies(header)[COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, secret()).sub;
  } catch {
    return null;
  }
}

export async function loadUser(req, _res, next) {
  const id = userIdFromCookie(req.headers.cookie);
  req.user = id ? await User.findById(id).catch(() => null) : null;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in to continue' });
  next();
}
