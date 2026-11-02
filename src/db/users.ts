import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateFirebaseUser(uid: string, email: string, fullName?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email: email || '',
        fullName: fullName || null,
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: email || '',
          lastLoginAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateFirebaseUser:', error);
    throw new Error('Failed to synchronize user account. Please try again later.', {
      cause: error,
    });
  }
}

export async function upsertPhoneVerifiedUser(
  phone: string,
  sessionToken: string,
  fullName?: string,
  existingUid?: string
) {
  try {
    const uid = existingUid || `phone:${phone}`;
    const existingByPhone = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (existingByPhone.length > 0) {
      const current = existingByPhone[0];
      const updated = await db
        .update(users)
        .set({
          isVerified: true,
          sessionToken,
          fullName: fullName || current.fullName,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, current.id))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(users)
      .values({
        uid,
        phone,
        fullName: fullName || null,
        email: '',
        role: 'user',
        isVerified: true,
        sessionToken,
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          phone,
          isVerified: true,
          sessionToken,
          lastLoginAt: new Date(),
        },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in upsertPhoneVerifiedUser:', error);
    throw new Error('Failed to verify and register phone user.', { cause: error });
  }
}

export async function getUserBySessionToken(sessionToken: string) {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.sessionToken, sessionToken))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserBySessionToken:', error);
    throw new Error('Failed to look up user session.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to look up user by UID.', { cause: error });
  }
}

export async function getUserById(id: number) {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserById:', error);
    throw new Error('Failed to fetch user profile.', { cause: error });
  }
}

export async function updateUserProfile(userId: number, data: { fullName?: string; phone?: string }) {
  try {
    const updated = await db
      .update(users)
      .set({
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in updateUserProfile:', error);
    throw new Error('Failed to update user profile.', { cause: error });
  }
}

export async function clearUserSessionToken(userId: number) {
  try {
    await db
      .update(users)
      .set({ sessionToken: null })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error('Database query failed in clearUserSessionToken:', error);
    throw new Error('Failed to sign out user session.', { cause: error });
  }
}
