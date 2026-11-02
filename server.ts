import express from 'express';
import path from 'path';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  AuthRequest,
  createAdminSessionToken,
  requireAdmin,
  requireAuth,
} from './src/middleware/auth.ts';
import {
  isValidBangladeshPhone,
  normalizeBangladeshPhone,
} from './src/utils/phone.ts';
import {
  checkDuplicateBooking,
  createBookingRecord,
  createOtpRecord,
  getAllBookingsForAdmin,
  getAllSmsLogsForAdmin,
  getAllUsersForAdmin,
  getBookingByNumericId,
  getLatestUnverifiedOtp,
  getRecentOtpsForPhone,
  incrementOtpAttempt,
  markOtpAsVerified,
  updateBookingSmsConfirmation,
  updateBookingStatusById,
  getUserBookings,
} from './src/db/queries.ts';
import {
  clearUserSessionToken,
  updateUserProfile,
  upsertPhoneVerifiedUser,
} from './src/db/users.ts';
import {
  formatBookingConfirmationSmsMessage,
  formatOtpSmsMessage,
  getBrandName,
  sendSmsViaBulkSmsBd,
} from './src/services/sms.ts';

dotenv.config();

const PORT = 3000;
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const OTP_MAX_VERIFY_ATTEMPTS = 5;

function generateSixDigitOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function generateUniqueBookingId(bookingDate: string): string {
  const cleanDate = bookingDate.replace(/-/g, '');
  const randomPart = crypto.randomInt(1000, 9999);
  return `BK-${cleanDate}-${randomPart}`;
}

function isPastDate(dateStr: string): boolean {
  // Expected format: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return true;
  const now = new Date();
  // Use Bangladesh Standard Time (UTC+6) date comparison so local users can book today
  const bdTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const todayStr = bdTime.toISOString().slice(0, 10);
  return dateStr < todayStr;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // ============================================================================
  // 1. PUBLIC CONFIG / HEALTH
  // ============================================================================
  app.get('/api/config', (_req, res) => {
    const apiKey = (process.env.BULKSMSBD_API_KEY || '').trim();
    const hasSmsApiKey = Boolean(apiKey && apiKey !== 'MY_BULKSMSBD_API_KEY');
    res.json({
      brandName: getBrandName(),
      senderId: (process.env.BULKSMSBD_SENDER_ID || '8809617623984').trim(),
      smsConfigured: hasSmsApiKey,
    });
  });

  // ============================================================================
  // 2. AUTHENTICATION: PHONE + OTP & FIREBASE SYNC
  // ============================================================================
  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const { phone } = req.body || {};
      if (!phone || typeof phone !== 'string') {
        return res
          .status(400)
          .json({ error: 'Please provide a Bangladesh mobile number.' });
      }

      if (!isValidBangladeshPhone(phone)) {
        return res.status(400).json({
          error:
            'Invalid Bangladesh mobile number. Use format 01XXXXXXXXX or +8801XXXXXXXXX (operators 013–019).',
        });
      }

      const normalizedPhone = normalizeBangladeshPhone(phone)!;
      const now = new Date();
      const windowStart = new Date(now.getTime() - OTP_RATE_LIMIT_WINDOW_MS);

      const recentOtps = await getRecentOtpsForPhone(
        normalizedPhone,
        windowStart
      );

      // 1. Check 60-second resend cooldown
      if (recentOtps.length > 0) {
        const latestOtp = recentOtps[0];
        const elapsedMs =
          now.getTime() - new Date(latestOtp.createdAt).getTime();
        if (elapsedMs < OTP_COOLDOWN_MS) {
          const remainingSeconds = Math.ceil(
            (OTP_COOLDOWN_MS - elapsedMs) / 1000
          );
          return res.status(429).json({
            error: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
            cooldownRemaining: remainingSeconds,
          });
        }
      }

      // 2. Check rate limit (max 5 OTPs per 15 minutes)
      if (recentOtps.length >= OTP_MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({
          error:
            'Too many OTP requests for this mobile number. Please wait 15 minutes before trying again.',
        });
      }

      const otpCode = generateSixDigitOtp();
      const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown';

      await createOtpRecord({
        phone: normalizedPhone,
        otpCode,
        expiresAt,
        ipAddress,
      });

      const smsMessage = formatOtpSmsMessage(otpCode);
      const smsResult = await sendSmsViaBulkSmsBd({
        phone: normalizedPhone,
        message: smsMessage,
        messageType: 'OTP',
      });

      if (!smsResult.success) {
        return res.status(502).json({
          error: `SMS delivery failed (${smsResult.responseCode}): ${smsResult.statusMessage}`,
          smsCode: smsResult.responseCode,
          smsStatusMessage: smsResult.statusMessage,
          cooldownSeconds: 60,
        });
      }

      return res.json({
        success: true,
        phone: normalizedPhone,
        message: `A 6-digit OTP has been sent to +${normalizedPhone} via BulkSMSBD.`,
        expiresInSeconds: 300,
        cooldownSeconds: 60,
        smsCode: smsResult.responseCode,
      });
    } catch (error: any) {
      console.error('Error in POST /api/auth/send-otp:', error);
      return res.status(500).json({
        error: error.message || 'Failed to generate and send OTP.',
      });
    }
  });

  app.post('/api/auth/verify-otp', async (req, res) => {
    try {
      const { phone, otp, fullName } = req.body || {};
      if (!phone || !otp) {
        return res
          .status(400)
          .json({ error: 'Mobile number and OTP code are required.' });
      }

      const normalizedPhone = normalizeBangladeshPhone(String(phone));
      if (!normalizedPhone) {
        return res
          .status(400)
          .json({ error: 'Invalid Bangladesh mobile number format.' });
      }

      const cleanedOtp = String(otp).trim();
      if (!/^\d{4,6}$/.test(cleanedOtp)) {
        return res
          .status(400)
          .json({ error: 'OTP must be a valid 4 to 6 digit numeric code.' });
      }

      const otpRecord = await getLatestUnverifiedOtp(normalizedPhone);
      if (!otpRecord) {
        return res.status(400).json({
          error:
            'No active unverified OTP found for this number. Please request a new OTP.',
        });
      }

      if (otpRecord.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
        return res.status(429).json({
          error:
            'Maximum verification attempts exceeded for this OTP. Please request a new OTP.',
        });
      }

      const now = new Date();
      if (new Date(otpRecord.expiresAt).getTime() < now.getTime()) {
        return res.status(400).json({
          error:
            'This OTP has expired (5-minute limit). Please request a new OTP.',
        });
      }

      if (otpRecord.otpCode !== cleanedOtp) {
        await incrementOtpAttempt(otpRecord.id, otpRecord.attempts);
        const remaining = Math.max(
          0,
          OTP_MAX_VERIFY_ATTEMPTS - (otpRecord.attempts + 1)
        );
        return res.status(400).json({
          error: `Incorrect OTP code. ${remaining} attempt(s) remaining.`,
        });
      }

      // Mark OTP as verified atomically to prevent duplicate verification
      const verifiedOtp = await markOtpAsVerified(otpRecord.id);
      if (!verifiedOtp) {
        return res.status(400).json({
          error: 'This OTP has already been used. Please request a new OTP.',
        });
      }

      const sessionToken = `otp_${crypto.randomBytes(32).toString('hex')}`;
      const user = await upsertPhoneVerifiedUser(
        normalizedPhone,
        sessionToken,
        fullName ? String(fullName).trim() : undefined
      );

      return res.json({
        success: true,
        token: sessionToken,
        user: {
          id: user.id,
          uid: user.uid,
          phone: user.phone,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
        },
      });
    } catch (error: any) {
      console.error('Error in POST /api/auth/verify-otp:', error);
      return res.status(500).json({
        error: error.message || 'Failed to verify OTP.',
      });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'User profile not found.' });
      }
      return res.json({ user: req.dbUser });
    } catch (error: any) {
      console.error('Error in GET /api/auth/me:', error);
      return res.status(500).json({ error: 'Failed to fetch current user.' });
    }
  });

  app.patch('/api/auth/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { fullName, phone } = req.body || {};
      let normalizedPhone: string | undefined;

      if (phone !== undefined && String(phone).trim() !== '') {
        const norm = normalizeBangladeshPhone(String(phone));
        if (!norm) {
          return res.status(400).json({
            error:
              'Please enter a valid Bangladesh mobile number (e.g. 01712345678).',
          });
        }
        normalizedPhone = norm;
      }

      const updated = await updateUserProfile(req.dbUser.id, {
        fullName: fullName !== undefined ? String(fullName).trim() : undefined,
        phone: normalizedPhone,
      });

      return res.json({ user: updated });
    } catch (error: any) {
      console.error('Error in PATCH /api/auth/profile:', error);
      return res.status(500).json({
        error: error.message || 'Failed to update user profile.',
      });
    }
  });

  app.post('/api/auth/logout', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser) {
        await clearUserSessionToken(req.dbUser.id);
      }
      return res.json({ success: true });
    } catch (error: any) {
      console.error('Error in POST /api/auth/logout:', error);
      return res.status(500).json({ error: 'Failed to log out.' });
    }
  });

  // ============================================================================
  // 3. USER BOOKINGS
  // ============================================================================
  app.get('/api/bookings/my', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const userBookings = await getUserBookings(
        req.dbUser.id,
        req.dbUser.phone
      );
      return res.json({ bookings: userBookings });
    } catch (error: any) {
      console.error('Error in GET /api/bookings/my:', error);
      return res.status(500).json({
        error: error.message || 'Failed to fetch bookings.',
      });
    }
  });

  app.post('/api/bookings', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const {
        fullName,
        phone,
        bookingDate,
        bookingTime,
        persons,
        serviceType,
        notes,
      } = req.body || {};

      const resolvedPhone = phone || req.dbUser.phone;
      if (!fullName || !String(fullName).trim()) {
        return res.status(400).json({ error: 'Full Name is required.' });
      }
      if (!resolvedPhone || !isValidBangladeshPhone(String(resolvedPhone))) {
        return res.status(400).json({
          error:
            'A valid Bangladesh mobile number (01XXXXXXXXX) is required for booking and SMS confirmation.',
        });
      }
      if (!bookingDate || typeof bookingDate !== 'string') {
        return res.status(400).json({ error: 'Booking Date is required.' });
      }
      if (isPastDate(bookingDate)) {
        return res.status(400).json({
          error:
            'Booking date cannot be in the past. Please choose today or a future date.',
        });
      }
      if (!bookingTime || typeof bookingTime !== 'string') {
        return res.status(400).json({ error: 'Booking Time is required.' });
      }
      if (!serviceType || !String(serviceType).trim()) {
        return res
          .status(400)
          .json({ error: 'Service / Booking Type is required.' });
      }

      const numPersons = Number(persons) || 1;
      if (numPersons < 1 || numPersons > 500) {
        return res.status(400).json({
          error: 'Number of persons must be between 1 and 500.',
        });
      }

      const normalizedPhone = normalizeBangladeshPhone(String(resolvedPhone))!;
      const cleanName = String(fullName).trim();
      const cleanService = String(serviceType).trim();
      const cleanNotes = notes ? String(notes).trim() : '';

      // Prevent duplicate booking submissions
      const duplicate = await checkDuplicateBooking({
        phone: normalizedPhone,
        bookingDate,
        bookingTime,
        serviceType: cleanService,
      });

      if (duplicate) {
        return res.status(409).json({
          error: `A booking (${duplicate.bookingId}) already exists for this date, time, and service.`,
        });
      }

      // Update user's full name / phone if not yet saved
      if (!req.dbUser.fullName || !req.dbUser.phone) {
        await updateUserProfile(req.dbUser.id, {
          fullName: cleanName,
          phone: normalizedPhone,
        });
      }

      const bookingId = generateUniqueBookingId(bookingDate);

      // 1. Save booking in PostgreSQL first with smsConfirmed = false
      const createdBooking = await createBookingRecord({
        bookingId,
        userId: req.dbUser.id,
        fullName: cleanName,
        phone: normalizedPhone,
        bookingDate,
        bookingTime,
        persons: numPersons,
        serviceType: cleanService,
        notes: cleanNotes,
        status: 'Pending',
        smsConfirmed: false,
      });

      // 2. Dispatch Booking Confirmation SMS via BulkSMSBD
      const smsMessage = formatBookingConfirmationSmsMessage({
        bookingId,
        date: bookingDate,
        time: bookingTime,
      });

      const smsResult = await sendSmsViaBulkSmsBd({
        phone: normalizedPhone,
        message: smsMessage,
        messageType: 'BOOKING_CONFIRMATION',
        bookingId,
      });

      // CRITICAL REQUIREMENT: Do not mark a booking as SMS-confirmed if SMS delivery submission fails.
      let finalBooking = createdBooking;
      if (smsResult.success) {
        const updated = await updateBookingSmsConfirmation(
          createdBooking.id,
          true,
          'Confirmed'
        );
        if (updated) {
          finalBooking = updated;
        }
      }

      return res.status(201).json({
        booking: finalBooking,
        smsResult: {
          sent: smsResult.success,
          code: smsResult.responseCode,
          message: smsResult.statusMessage,
        },
      });
    } catch (error: any) {
      console.error('Error in POST /api/bookings:', error);
      return res.status(500).json({
        error: error.message || 'Failed to create booking.',
      });
    }
  });

  app.post(
    '/api/bookings/:id/cancel',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        if (!req.dbUser) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        const bookingNumericId = Number(req.params.id);
        if (!bookingNumericId) {
          return res.status(400).json({ error: 'Invalid booking ID.' });
        }

        const existing = await getBookingByNumericId(bookingNumericId);
        if (!existing) {
          return res.status(404).json({ error: 'Booking not found.' });
        }

        // Verify ownership (by userId or matching verified phone)
        if (
          existing.userId !== req.dbUser.id &&
          existing.phone !== req.dbUser.phone
        ) {
          return res
            .status(403)
            .json({ error: 'You are not authorized to cancel this booking.' });
        }

        if (existing.status === 'Cancelled') {
          return res
            .status(400)
            .json({ error: 'This booking is already cancelled.' });
        }
        if (existing.status === 'Completed') {
          return res
            .status(400)
            .json({ error: 'Completed bookings cannot be cancelled.' });
        }

        const updated = await updateBookingStatusById(
          existing.id,
          'Cancelled'
        );
        return res.json({ booking: updated });
      } catch (error: any) {
        console.error('Error in POST /api/bookings/:id/cancel:', error);
        return res.status(500).json({
          error: error.message || 'Failed to cancel booking.',
        });
      }
    }
  );

  // ============================================================================
  // 4. ADMIN DASHBOARD API
  // ============================================================================
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body || {};
    const expectedUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
    const expectedPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim();

    if (
      String(username || '').trim() === expectedUsername &&
      String(password || '').trim() === expectedPassword
    ) {
      const adminToken = createAdminSessionToken(expectedUsername);
      return res.json({
        success: true,
        token: adminToken,
        admin: { username: expectedUsername, role: 'admin' },
      });
    }

    return res
      .status(401)
      .json({ error: 'Invalid admin username or password.' });
  });

  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    try {
      const [allBookings, allUsers, allSmsLogs] = await Promise.all([
        getAllBookingsForAdmin(),
        getAllUsersForAdmin(),
        getAllSmsLogsForAdmin(),
      ]);

      const apiKey = (process.env.BULKSMSBD_API_KEY || '').trim();
      const smsConfigured = Boolean(
        apiKey && apiKey !== 'MY_BULKSMSBD_API_KEY'
      );

      return res.json({
        bookings: allBookings,
        users: allUsers,
        smsLogs: allSmsLogs,
        gatewayConfig: {
          provider: 'BulkSMSBD',
          endpoint: 'http://bulksmsbd.net/api/smsapi',
          senderId: (process.env.BULKSMSBD_SENDER_ID || '8809617623984').trim(),
          brandName: getBrandName(),
          apiKeyConfigured: smsConfigured,
        },
      });
    } catch (error: any) {
      console.error('Error in GET /api/admin/overview:', error);
      return res.status(500).json({
        error: error.message || 'Failed to load admin overview data.',
      });
    }
  });

  app.patch(
    '/api/admin/bookings/:id/status',
    requireAdmin,
    async (req, res) => {
      try {
        const numericId = Number(req.params.id);
        const { status } = req.body || {};
        const allowedStatuses = [
          'Pending',
          'Confirmed',
          'Cancelled',
          'Completed',
        ];

        if (!numericId || !allowedStatuses.includes(status)) {
          return res.status(400).json({
            error:
              'Valid booking ID and status (Pending, Confirmed, Cancelled, Completed) are required.',
          });
        }

        const existing = await getBookingByNumericId(numericId);
        if (!existing) {
          return res.status(404).json({ error: 'Booking not found.' });
        }

        const updated = await updateBookingStatusById(numericId, status);
        return res.json({ booking: updated });
      } catch (error: any) {
        console.error('Error in PATCH /api/admin/bookings/:id/status:', error);
        return res.status(500).json({
          error: error.message || 'Failed to update booking status.',
        });
      }
    }
  );

  app.post(
    '/api/admin/bookings/:id/resend-sms',
    requireAdmin,
    async (req, res) => {
      try {
        const numericId = Number(req.params.id);
        if (!numericId) {
          return res.status(400).json({ error: 'Invalid booking ID.' });
        }

        const booking = await getBookingByNumericId(numericId);
        if (!booking) {
          return res.status(404).json({ error: 'Booking not found.' });
        }

        const smsMessage = formatBookingConfirmationSmsMessage({
          bookingId: booking.bookingId,
          date: booking.bookingDate,
          time: booking.bookingTime,
        });

        const smsResult = await sendSmsViaBulkSmsBd({
          phone: booking.phone,
          message: smsMessage,
          messageType: 'ADMIN_RESEND',
          bookingId: booking.bookingId,
        });

        let updatedBooking = booking;
        if (smsResult.success) {
          const nextStatus =
            booking.status === 'Pending' ? 'Confirmed' : booking.status;
          const resUpdate = await updateBookingSmsConfirmation(
            booking.id,
            true,
            nextStatus
          );
          if (resUpdate) {
            updatedBooking = resUpdate;
          }
        }

        if (!smsResult.success) {
          return res.status(502).json({
            error: `BulkSMSBD Error (${smsResult.responseCode}): ${smsResult.statusMessage}`,
            booking: updatedBooking,
            smsResult,
          });
        }

        return res.json({
          success: true,
          booking: updatedBooking,
          smsResult,
        });
      } catch (error: any) {
        console.error(
          'Error in POST /api/admin/bookings/:id/resend-sms:',
          error
        );
        return res.status(500).json({
          error: error.message || 'Failed to resend booking confirmation SMS.',
        });
      }
    }
  );

  // ============================================================================
  // 5. VITE DEV MIDDLEWARE / PRODUCTION STATIC ASSETS
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
