import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from './index.ts';
import { bookings, otpVerifications, smsLogs, users } from './schema.ts';

export async function getRecentOtpsForPhone(phone: string, sinceDate: Date) {
  try {
    return await db
      .select()
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.phone, phone),
          gte(otpVerifications.createdAt, sinceDate)
        )
      )
      .orderBy(desc(otpVerifications.createdAt));
  } catch (error) {
    console.error('Database query failed in getRecentOtpsForPhone:', error);
    throw new Error('Failed to check OTP rate limits.', { cause: error });
  }
}

export async function createOtpRecord(data: {
  phone: string;
  otpCode: string;
  expiresAt: Date;
  ipAddress?: string;
}) {
  try {
    const inserted = await db
      .insert(otpVerifications)
      .values({
        phone: data.phone,
        otpCode: data.otpCode,
        expiresAt: data.expiresAt,
        verified: false,
        attempts: 0,
        ipAddress: data.ipAddress || null,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createOtpRecord:', error);
    throw new Error('Failed to store OTP verification record.', { cause: error });
  }
}

export async function getLatestUnverifiedOtp(phone: string) {
  try {
    const rows = await db
      .select()
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.phone, phone),
          eq(otpVerifications.verified, false)
        )
      )
      .orderBy(desc(otpVerifications.createdAt))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getLatestUnverifiedOtp:', error);
    throw new Error('Failed to retrieve OTP record.', { cause: error });
  }
}

export async function incrementOtpAttempt(otpId: number, currentAttempts: number) {
  try {
    await db
      .update(otpVerifications)
      .set({ attempts: currentAttempts + 1 })
      .where(eq(otpVerifications.id, otpId));
  } catch (error) {
    console.error('Database query failed in incrementOtpAttempt:', error);
    throw new Error('Failed to update OTP attempt count.', { cause: error });
  }
}

export async function markOtpAsVerified(otpId: number) {
  try {
    const updated = await db
      .update(otpVerifications)
      .set({ verified: true })
      .where(
        and(
          eq(otpVerifications.id, otpId),
          eq(otpVerifications.verified, false)
        )
      )
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in markOtpAsVerified:', error);
    throw new Error('Failed to mark OTP as verified.', { cause: error });
  }
}

export async function checkDuplicateBooking(data: {
  phone: string;
  bookingDate: string;
  bookingTime: string;
  serviceType: string;
}) {
  try {
    const existing = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.phone, data.phone),
          eq(bookings.bookingDate, data.bookingDate),
          eq(bookings.bookingTime, data.bookingTime),
          eq(bookings.serviceType, data.serviceType)
        )
      )
      .limit(5);

    return existing.find((b) => b.status !== 'Cancelled') || null;
  } catch (error) {
    console.error('Database query failed in checkDuplicateBooking:', error);
    throw new Error('Failed to validate duplicate bookings.', { cause: error });
  }
}

export async function createBookingRecord(data: {
  bookingId: string;
  userId: number;
  fullName: string;
  phone: string;
  bookingDate: string;
  bookingTime: string;
  persons: number;
  serviceType: string;
  notes?: string;
  status: string;
  smsConfirmed: boolean;
}) {
  try {
    const inserted = await db
      .insert(bookings)
      .values({
        bookingId: data.bookingId,
        userId: data.userId,
        fullName: data.fullName,
        phone: data.phone,
        bookingDate: data.bookingDate,
        bookingTime: data.bookingTime,
        persons: data.persons,
        serviceType: data.serviceType,
        notes: data.notes || '',
        status: data.status,
        smsConfirmed: data.smsConfirmed,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createBookingRecord:', error);
    throw new Error('Failed to save booking to database.', { cause: error });
  }
}

export async function updateBookingSmsConfirmation(
  id: number,
  smsConfirmed: boolean,
  status?: string
) {
  try {
    const updated = await db
      .update(bookings)
      .set({
        smsConfirmed,
        ...(status ? { status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in updateBookingSmsConfirmation:', error);
    throw new Error('Failed to update booking SMS status.', { cause: error });
  }
}

export async function getUserBookings(userId: number, phone?: string | null) {
  try {
    if (phone) {
      return await db
        .select()
        .from(bookings)
        .where(eq(bookings.phone, phone))
        .orderBy(desc(bookings.createdAt));
    }
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.userId, userId))
      .orderBy(desc(bookings.createdAt));
  } catch (error) {
    console.error('Database query failed in getUserBookings:', error);
    throw new Error('Failed to load your bookings.', { cause: error });
  }
}

export async function getBookingByIdOrCode(idOrCode: string) {
  try {
    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.bookingId, idOrCode))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getBookingByIdOrCode:', error);
    throw new Error('Failed to retrieve booking details.', { cause: error });
  }
}

export async function getBookingByNumericId(id: number) {
  try {
    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, id))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getBookingByNumericId:', error);
    throw new Error('Failed to retrieve booking details.', { cause: error });
  }
}

export async function updateBookingStatusById(id: number, status: string) {
  try {
    const updated = await db
      .update(bookings)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in updateBookingStatusById:', error);
    throw new Error('Failed to update booking status.', { cause: error });
  }
}

export async function getAllBookingsForAdmin() {
  try {
    return await db
      .select()
      .from(bookings)
      .orderBy(desc(bookings.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllBookingsForAdmin:', error);
    throw new Error('Failed to load bookings for admin dashboard.', { cause: error });
  }
}

export async function getAllUsersForAdmin() {
  try {
    return await db
      .select({
        id: users.id,
        uid: users.uid,
        phone: users.phone,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        isVerified: users.isVerified,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllUsersForAdmin:', error);
    throw new Error('Failed to load registered users.', { cause: error });
  }
}

export async function createSmsLogRecord(data: {
  recipientPhone: string;
  messageType: string;
  messageContent: string;
  senderId: string;
  status: string;
  responseCode: string;
  rawResponse: string;
  bookingId?: string;
}) {
  try {
    const inserted = await db
      .insert(smsLogs)
      .values({
        recipientPhone: data.recipientPhone,
        messageType: data.messageType,
        messageContent: data.messageContent,
        senderId: data.senderId,
        status: data.status,
        responseCode: data.responseCode,
        rawResponse: data.rawResponse,
        bookingId: data.bookingId || null,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createSmsLogRecord:', error);
    throw new Error('Failed to write SMS audit log.', { cause: error });
  }
}

export async function getAllSmsLogsForAdmin() {
  try {
    return await db
      .select()
      .from(smsLogs)
      .orderBy(desc(smsLogs.createdAt))
      .limit(250);
  } catch (error) {
    console.error('Database query failed in getAllSmsLogsForAdmin:', error);
    throw new Error('Failed to load SMS logs.', { cause: error });
  }
}
