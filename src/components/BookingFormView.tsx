import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Phone,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { safeFetchJson } from '../utils/api.ts';
import { BookingRecord } from '../types.ts';
import {
  formatBangladeshPhoneDisplay,
  isValidBangladeshPhone,
  toLocalBangladeshPhone,
} from '../utils/phone.ts';

export const SERVICE_CATALOG = [
  {
    id: 'Executive Dining Reservation',
    name: 'Executive Dining Reservation',
    duration: '90 mins',
    capacity: '1–20 guests',
    description: 'Private table allocation with priority host greeting.',
  },
  {
    id: 'Specialist Consultation',
    name: 'Specialist Consultation',
    duration: '45 mins',
    capacity: '1–3 persons',
    description: 'One-on-one scheduled advisory session.',
  },
  {
    id: 'Private Conference Suite',
    name: 'Private Conference Suite',
    duration: '2 hours',
    capacity: '4–30 persons',
    description: 'Boardroom suite equipped with AV and high-speed fiber.',
  },
  {
    id: 'Wellness & Spa Session',
    name: 'Wellness & Spa Session',
    duration: '60 mins',
    capacity: '1–4 persons',
    description: 'Dedicated treatment room and specialist therapist.',
  },
  {
    id: 'Priority Lounge Access',
    name: 'Priority Lounge Access',
    duration: '3 hours',
    capacity: '1–10 guests',
    description: 'Complimentary refreshments and quiet workspace seating.',
  },
  {
    id: 'Corporate Event Hall',
    name: 'Corporate Event Hall',
    duration: '4 hours',
    capacity: '20–250 guests',
    description: 'Full banquet and seminar hall with custom seating layout.',
  },
];

const TIME_SLOTS = [
  '09:00',
  '10:00',
  '11:00',
  '12:30',
  '14:00',
  '15:30',
  '17:00',
  '18:30',
  '19:30',
  '20:30',
];

function getTodayDateString(): string {
  const now = new Date();
  const bdTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return bdTime.toISOString().slice(0, 10);
}

interface BookingFormViewProps {
  onBookingCreated: () => void;
  onNavigateToDashboard: () => void;
  initialService?: string;
}

export const BookingFormView: React.FC<BookingFormViewProps> = ({
  onBookingCreated,
  onNavigateToDashboard,
  initialService,
}) => {
  const { user, token } = useAuth();
  const todayStr = getTodayDateString();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(
    user?.phone ? toLocalBangladeshPhone(user.phone) : ''
  );
  const [bookingDate, setBookingDate] = useState(todayStr);
  const [bookingTime, setBookingTime] = useState('18:30');
  const [persons, setPersons] = useState(2);
  const [serviceType, setServiceType] = useState(
    initialService || SERVICE_CATALOG[0].id
  );
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedResult, setConfirmedResult] = useState<{
    booking: BookingRecord;
    smsResult: { sent: boolean; code: string; message: string };
  } | null>(null);

  useEffect(() => {
    if (user?.fullName && !fullName) {
      setFullName(user.fullName);
    }
    if (user?.phone && !phone) {
      setPhone(toLocalBangladeshPhone(user.phone));
    }
  }, [user]);

  useEffect(() => {
    if (initialService) {
      setServiceType(initialService);
    }
  }, [initialService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!isValidBangladeshPhone(phone)) {
      setErrorMessage(
        'Please enter a valid Bangladesh mobile number (e.g., 01712345678).'
      );
      return;
    }
    if (!bookingDate || bookingDate < todayStr) {
      setErrorMessage(
        'Booking date cannot be in the past. Please select today or a future date.'
      );
      return;
    }
    if (!bookingTime) {
      setErrorMessage('Please select a booking time.');
      return;
    }
    if (persons < 1 || persons > 500) {
      setErrorMessage('Number of persons must be between 1 and 500.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone,
          bookingDate,
          bookingTime,
          persons,
          serviceType,
          notes: notes.trim(),
        }),
      });

      const { ok, data } = await safeFetchJson(res);
      if (!ok) {
        setErrorMessage(data.error || 'Failed to submit booking.');
        return;
      }

      setConfirmedResult(data);
      onBookingCreated();
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Network error while submitting your booking.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedResult) {
    const { booking, smsResult } = confirmedResult;
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 max-w-2xl mx-auto">
        <div className="flex items-start gap-3.5 pb-6 border-b border-slate-200">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-slate-500">
              Reservation Recorded · PostgreSQL & BulkSMSBD
            </p>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">
              Booking Submitted Successfully
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Your unique Booking ID is{' '}
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {booking.bookingId}
              </span>
              .
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 py-6 border-b border-slate-200 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Booking ID</dt>
            <dd className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
              {booking.bookingId}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Booking Status</dt>
            <dd className="font-semibold text-slate-900 mt-0.5">
              {booking.status}{' '}
              <span className="text-slate-400 font-normal">·</span>{' '}
              <span
                className={
                  booking.smsConfirmed ? 'text-emerald-700' : 'text-amber-700'
                }
              >
                {booking.smsConfirmed
                  ? 'SMS Confirmed'
                  : 'SMS Delivery Pending'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Guest / Client Name</dt>
            <dd className="font-medium text-slate-900 mt-0.5">
              {booking.fullName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Mobile Number</dt>
            <dd className="font-mono text-slate-900 tabular-nums mt-0.5">
              {formatBangladeshPhoneDisplay(booking.phone)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Date & Time</dt>
            <dd className="font-mono text-slate-900 tabular-nums mt-0.5">
              {booking.bookingDate} at {booking.bookingTime}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Service & Party Size</dt>
            <dd className="font-medium text-slate-900 mt-0.5">
              {booking.serviceType} ·{' '}
              <span className="font-mono tabular-nums">{booking.persons}</span>{' '}
              {booking.persons === 1 ? 'person' : 'persons'}
            </dd>
          </div>
          {booking.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Additional Notes</dt>
              <dd className="text-slate-700 mt-0.5">{booking.notes}</dd>
            </div>
          )}
        </dl>

        <div
          className={`my-6 p-4 rounded-lg border text-xs ${
            smsResult.sent
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="font-semibold mb-1">
            {smsResult.sent
              ? `Confirmation SMS Dispatched (Code ${smsResult.code})`
              : `SMS Gateway Notice (Code ${smsResult.code})`}
          </div>
          <p className="leading-relaxed">
            {smsResult.sent
              ? `SMS sent to ${formatBangladeshPhoneDisplay(
                  booking.phone
                )}: "Your booking has been confirmed! Booking ID: ${
                  booking.bookingId
                }. Date: ${booking.bookingDate}, Time: ${
                  booking.bookingTime
                }."`
              : `Your booking is saved as Pending because the SMS gateway returned: ${smsResult.message}. An administrator can resend your confirmation SMS at any time.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setConfirmedResult(null);
              setNotes('');
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Book Another Reservation
          </button>
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            View in My Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
      <div className="mb-6 pb-4 border-b border-slate-200">
        <p className="text-xs font-medium text-emerald-700">
          Instant SMS Confirmation
        </p>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
          Create a New Booking
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Complete the form below. Once submitted, your unique Booking ID and
          confirmation details will be sent to your Bangladesh mobile number.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="booking-fullname"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Full Name <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="booking-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="booking-phone"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Mobile Number (Bangladesh) <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="booking-phone"
                type="tel"
                required
                readOnly={Boolean(user?.phone && user.isVerified)}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01712345678"
                className={`w-full pl-10 pr-3.5 py-2.5 text-sm font-mono tabular-nums border rounded-lg focus:outline-none ${
                  user?.phone && user.isVerified
                    ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-600'
                }`}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {user?.phone && user.isVerified
                ? 'Automatically populated from your OTP-verified login.'
                : 'SMS confirmation will be sent to this Bangladesh number.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label
              htmlFor="booking-date"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Booking Date <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                id="booking-date"
                type="date"
                required
                min={todayStr}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="booking-time"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Booking Time <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Clock className="w-4 h-4" />
              </div>
              <select
                id="booking-time"
                value={bookingTime}
                onChange={(e) => setBookingTime(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot} BST
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="booking-persons"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Number of Persons <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Users className="w-4 h-4" />
              </div>
              <input
                id="booking-persons"
                type="number"
                min={1}
                max={500}
                required
                value={persons}
                onChange={(e) =>
                  setPersons(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="booking-service"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Service / Booking Type <span className="text-red-600">*</span>
          </label>
          <select
            id="booking-service"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
          >
            {SERVICE_CATALOG.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.duration} · {service.capacity})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="booking-notes"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Additional Notes{' '}
            <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <textarea
              id="booking-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special seating requests, dietary preferences, or arrival notes..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Confirming & Sending SMS...</span>
              </>
            ) : (
              <span>Submit Booking</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
