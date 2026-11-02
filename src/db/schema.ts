import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    phone: text('phone').unique(),
    fullName: text('full_name'),
    email: text('email').notNull().default(''),
    role: text('role').notNull().default('user'),
    isVerified: boolean('is_verified').notNull().default(false),
    sessionToken: text('session_token'),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_phone').on(table.phone),
    index('idx_users_session_token').on(table.sessionToken),
  ]
);

export const otpVerifications = pgTable(
  'otp_verifications',
  {
    id: serial('id').primaryKey(),
    phone: text('phone').notNull(),
    otpCode: text('otp_code').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    verified: boolean('verified').notNull().default(false),
    attempts: integer('attempts').notNull().default(0),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_otp_phone').on(table.phone),
    index('idx_otp_created_at').on(table.createdAt),
  ]
);

export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),
    bookingId: text('booking_id').notNull().unique(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    bookingDate: text('booking_date').notNull(),
    bookingTime: text('booking_time').notNull(),
    persons: integer('persons').notNull().default(1),
    serviceType: text('service_type').notNull(),
    notes: text('notes').default(''),
    status: text('status').notNull().default('Pending'),
    smsConfirmed: boolean('sms_confirmed').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_bookings_booking_id').on(table.bookingId),
    index('idx_bookings_phone').on(table.phone),
    index('idx_bookings_user_id').on(table.userId),
    index('idx_bookings_date_status').on(table.bookingDate, table.status),
  ]
);

export const smsLogs = pgTable(
  'sms_logs',
  {
    id: serial('id').primaryKey(),
    recipientPhone: text('recipient_phone').notNull(),
    messageType: text('message_type').notNull(),
    messageContent: text('message_content').notNull(),
    senderId: text('sender_id').notNull(),
    status: text('status').notNull(),
    responseCode: text('response_code').default(''),
    rawResponse: text('raw_response').default(''),
    bookingId: text('booking_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_sms_logs_phone').on(table.recipientPhone),
    index('idx_sms_logs_booking_id').on(table.bookingId),
    index('idx_sms_logs_created_at').on(table.createdAt),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
}));
