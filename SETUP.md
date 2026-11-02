# DhakaReserve — SMS-Based Booking System Setup Guide

## 1. Environment Variables
Configure the following variables in your environment (or AI Studio Secrets panel):

- `BULKSMSBD_API_KEY`: Your API key from BulkSMSBD (`http://bulksmsbd.net/api/smsapi`).
- `BULKSMSBD_SENDER_ID`: Approved Sender ID (Default: `8809617623984`).
- `BRAND_NAME`: Brand/Company name used in OTP and Booking Confirmation SMS messages (Default: `DhakaReserve`).
- `ADMIN_USERNAME`: Admin dashboard login username (Default: `admin`).
- `ADMIN_PASSWORD`: Admin dashboard login password (Default: `admin123`).

## 2. Database Setup (PostgreSQL / Drizzle ORM)
The PostgreSQL schema is defined in `src/db/schema.ts` and SQL migrations are available in `migrations/0001_initial_schema.sql`.

Tables included:
1. `users`: Stores registered users (`uid`, `phone`, `full_name`, `email`, `role`, `is_verified`, `session_token`, `last_login_at`).
2. `otp_verifications`: Tracks OTP codes, 5-minute expiration timestamps, verification state, and verification attempts for rate limiting.
3. `bookings`: Stores user reservations with unique Booking IDs (`BK-YYYYMMDD-XXXX`), service details, status (`Pending`, `Confirmed`, `Cancelled`, `Completed`), and `sms_confirmed` delivery status.
4. `sms_logs`: Full audit log of every SMS sent via BulkSMSBD (`OTP`, `BOOKING_CONFIRMATION`, `ADMIN_RESEND`) with HTTP/API response codes and raw payload logs.

## 3. BulkSMSBD API Specification
All SMS dispatches execute strictly from the Node.js/Express backend (`src/services/sms.ts`):
- **Endpoint**: `http://bulksmsbd.net/api/smsapi`
- **Parameters**: `api_key`, `type=text`, `number` (normalized to `8801XXXXXXXXX`), `senderid=8809617623984`, `message` (URL-encoded).
- **OTP Format**: `Your {Brand/Company Name} OTP is XXXX`
- **Booking Confirmation Format**: `Your booking has been confirmed! Booking ID: {BOOKING_ID}. Date: {DATE}, Time: {TIME}. Thank you for choosing {BRAND_NAME}.`
