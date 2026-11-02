import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import crypto from 'crypto';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  getOrCreateFirebaseUser,
  getUserBySessionToken,
} from '../db/users.ts';

export interface AuthenticatedUserRecord {
  id: number;
  uid: string;
  phone: string | null;
  fullName: string | null;
  email: string;
  role: string;
  isVerified: boolean;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: AuthenticatedUserRecord;
  isAdmin?: boolean;
}

// Active admin tokens in memory (backed by signed HMAC verification so restarts don't invalidate rapidly)
const ADMIN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || 'dhaka-reserve-admin-hmac-key-2026';

export function createAdminSessionToken(username: string): string {
  const payload = JSON.stringify({
    sub: username,
    role: 'admin',
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
  });
  const base64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', ADMIN_SECRET)
    .update(base64Payload)
    .digest('base64url');
  return `adm.${base64Payload}.${signature}`;
}

export function verifyAdminSessionToken(token: string): boolean {
  if (!token.startsWith('adm.')) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [, base64Payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', ADMIN_SECRET)
    .update(base64Payload)
    .digest('base64url');
  if (signature !== expectedSig) return false;
  try {
    const data = JSON.parse(Buffer.from(base64Payload, 'base64url').toString());
    return data.role === 'admin' && data.exp > Date.now();
  } catch {
    return false;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token' });
  }

  try {
    // 1. Check if token is a Phone OTP Session Token (prefixed with "otp_")
    if (token.startsWith('otp_')) {
      const dbUser = await getUserBySessionToken(token);
      if (!dbUser) {
        return res
          .status(401)
          .json({ error: 'Session expired or invalid. Please log in again.' });
      }
      req.dbUser = dbUser;
      req.user = {
        uid: dbUser.uid,
        phone_number: dbUser.phone || undefined,
      } as DecodedIdToken;
      return next();
    }

    // 2. Otherwise verify as a Firebase ID Token
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const dbUser = await getOrCreateFirebaseUser(
      decodedToken.uid,
      decodedToken.email || '',
      decodedToken.name || undefined
    );
    req.dbUser = dbUser;
    return next();
  } catch (error) {
    console.error('Error verifying authentication token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Admin credentials required' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (verifyAdminSessionToken(token)) {
    req.isAdmin = true;
    return next();
  }

  // Also allow authenticated users with role === 'admin'
  try {
    if (token.startsWith('otp_')) {
      const dbUser = await getUserBySessionToken(token);
      if (dbUser && dbUser.role === 'admin') {
        req.dbUser = dbUser;
        req.isAdmin = true;
        return next();
      }
    } else {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const dbUser = await getOrCreateFirebaseUser(
        decodedToken.uid,
        decodedToken.email || ''
      );
      if (dbUser && dbUser.role === 'admin') {
        req.user = decodedToken;
        req.dbUser = dbUser;
        req.isAdmin = true;
        return next();
      }
    }
  } catch {
    // Ignore fallback error
  }

  return res.status(403).json({ error: 'Forbidden: Admin access required' });
};
