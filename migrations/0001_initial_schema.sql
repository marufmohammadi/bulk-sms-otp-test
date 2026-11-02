-- Migration: 0001_initial_schema.sql
-- PostgreSQL Schema for SMS-Based Booking System (Users, OTP Verifications, Bookings, SMS Logs)

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "uid" text NOT NULL UNIQUE,
  "phone" text UNIQUE,
  "full_name" text,
  "email" text DEFAULT '' NOT NULL,
  "role" text DEFAULT 'user' NOT NULL,
  "is_verified" boolean DEFAULT false NOT NULL,
  "session_token" text,
  "last_login_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "otp_verifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "phone" text NOT NULL,
  "otp_code" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "verified" boolean DEFAULT false NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "ip_address" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bookings" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" text NOT NULL UNIQUE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "full_name" text NOT NULL,
  "phone" text NOT NULL,
  "booking_date" text NOT NULL,
  "booking_time" text NOT NULL,
  "persons" integer DEFAULT 1 NOT NULL,
  "service_type" text NOT NULL,
  "notes" text DEFAULT '',
  "status" text DEFAULT 'Pending' NOT NULL,
  "sms_confirmed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sms_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "recipient_phone" text NOT NULL,
  "message_type" text NOT NULL,
  "message_content" text NOT NULL,
  "sender_id" text NOT NULL,
  "status" text NOT NULL,
  "response_code" text DEFAULT '',
  "raw_response" text DEFAULT '',
  "booking_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for fast lookup and rate-limiting queries
CREATE INDEX IF NOT EXISTS "idx_users_phone" ON "users" USING btree ("phone");
CREATE INDEX IF NOT EXISTS "idx_users_session_token" ON "users" USING btree ("session_token");
CREATE INDEX IF NOT EXISTS "idx_otp_phone" ON "otp_verifications" USING btree ("phone");
CREATE INDEX IF NOT EXISTS "idx_otp_created_at" ON "otp_verifications" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "idx_bookings_booking_id" ON "bookings" USING btree ("booking_id");
CREATE INDEX IF NOT EXISTS "idx_bookings_phone" ON "bookings" USING btree ("phone");
CREATE INDEX IF NOT EXISTS "idx_bookings_user_id" ON "bookings" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_bookings_date_status" ON "bookings" USING btree ("booking_date", "status");
CREATE INDEX IF NOT EXISTS "idx_sms_logs_phone" ON "sms_logs" USING btree ("recipient_phone");
CREATE INDEX IF NOT EXISTS "idx_sms_logs_booking_id" ON "sms_logs" USING btree ("booking_id");
CREATE INDEX IF NOT EXISTS "idx_sms_logs_created_at" ON "sms_logs" USING btree ("created_at");

-- Row Level Security (RLS) Policies for PostgreSQL / Supabase compatibility
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "otp_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_logs" ENABLE ROW LEVEL SECURITY;

-- Service role / backend app user full access policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'backend_users_all'
  ) THEN
    CREATE POLICY "backend_users_all" ON "users" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'otp_verifications' AND policyname = 'backend_otp_all'
  ) THEN
    CREATE POLICY "backend_otp_all" ON "otp_verifications" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'backend_bookings_all'
  ) THEN
    CREATE POLICY "backend_bookings_all" ON "bookings" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'backend_sms_logs_all'
  ) THEN
    CREATE POLICY "backend_sms_logs_all" ON "sms_logs" FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;
