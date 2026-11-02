import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { safeFetchJson } from '../utils/api.ts';
import { BookingRecord } from '../types.ts';
import { formatBangladeshPhoneDisplay } from '../utils/phone.ts';

interface UserDashboardViewProps {
  onNewBooking: () => void;
  refreshTrigger: number;
}

export const UserDashboardView: React.FC<UserDashboardViewProps> = ({
  onNewBooking,
  refreshTrigger,
}) => {
  const { user, token } = useAuth();

  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const fetchMyBookings = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/bookings/my', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const { ok, data } = await safeFetchJson(res);
      if (!ok) {
        throw new Error(data.error || 'Failed to load bookings.');
      }
      setBookings(data.bookings || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to fetch your bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBookings();
  }, [token, refreshTrigger]);

  const handleCancelBooking = async (bookingId: number) => {
    setCancellingId(bookingId);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const { ok, data } = await safeFetchJson(res);
      if (!ok) {
        throw new Error(data.error || 'Could not cancel booking.');
      }
      setBookings((prev) =>
        prev.map((item) => (item.id === bookingId ? data.booking : item))
      );
      setConfirmCancelId(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to cancel booking.');
    } finally {
      setCancellingId(null);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesStatus =
      statusFilter === 'ALL' || b.status.toUpperCase() === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.bookingId.toLowerCase().includes(q) ||
      b.serviceType.toLowerCase().includes(q) ||
      b.bookingDate.includes(q);
    return matchesStatus && matchesSearch;
  });

  const totalCount = bookings.length;
  const confirmedCount = bookings.filter(
    (b) => b.status === 'Confirmed'
  ).length;
  const pendingCount = bookings.filter((b) => b.status === 'Pending').length;

  const getStatusTextClass = (status: BookingRecord['status']) => {
    switch (status) {
      case 'Confirmed':
        return 'text-emerald-700 font-semibold';
      case 'Pending':
        return 'text-amber-700 font-semibold';
      case 'Cancelled':
        return 'text-red-700 font-semibold';
      case 'Completed':
        return 'text-slate-700 font-semibold';
      default:
        return 'text-slate-700';
    }
  };

  return (
    <div className="space-y-8">
      {/* User Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Account Dashboard</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {user?.phone
                  ? formatBangladeshPhoneDisplay(user.phone)
                  : user?.email || 'Authenticated User'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-medium">
                {user?.isVerified ? 'OTP Verified' : 'Active Session'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              {user?.fullName ? `Welcome, ${user.fullName}` : 'My Reservations'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchMyBookings}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onNewBooking}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Booking</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 pt-5">
          <div>
            <p className="text-xs text-slate-500">Total Bookings</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {totalCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Confirmed</p>
            <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
              {confirmedCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Pending Confirmation</p>
            <p className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-0.5">
              {pendingCount}
            </p>
          </div>
        </div>
      </div>

      {/* Bookings Filter & Table Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {[
              { id: 'ALL', label: 'All Bookings' },
              { id: 'CONFIRMED', label: 'Confirmed' },
              { id: 'PENDING', label: 'Pending' },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'CANCELLED', label: 'Cancelled' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Booking ID or service..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="m-6 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
            <span className="text-xs">Loading your booking history...</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center max-w-md mx-auto">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">
              No bookings found
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              {bookings.length === 0
                ? 'You have not created any reservations yet. Book your first appointment to receive an instant SMS confirmation.'
                : 'No bookings match your current filter or search query.'}
            </p>
            {bookings.length === 0 && (
              <button
                type="button"
                onClick={onNewBooking}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                Create First Booking
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-5 whitespace-nowrap">Booking ID</th>
                  <th className="py-3 px-5 whitespace-nowrap">
                    Service / Booking Type
                  </th>
                  <th className="py-3 px-5 whitespace-nowrap">Date & Time</th>
                  <th className="py-3 px-5 text-right whitespace-nowrap">
                    Persons
                  </th>
                  <th className="py-3 px-5 whitespace-nowrap">
                    Status & SMS Delivery
                  </th>
                  <th className="py-3 px-5 text-right whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredBookings.map((booking) => {
                  const canCancel =
                    booking.status === 'Pending' ||
                    booking.status === 'Confirmed';
                  return (
                    <tr
                      key={booking.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {booking.bookingId}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-slate-900">
                          {booking.serviceType}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {booking.fullName} ·{' '}
                          <span className="font-mono tabular-nums">
                            {formatBangladeshPhoneDisplay(booking.phone)}
                          </span>
                          {booking.notes ? ` · ${booking.notes}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        <div>{booking.bookingDate}</div>
                        <div className="text-slate-500">
                          {booking.bookingTime} BST
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-xs text-slate-900 tabular-nums whitespace-nowrap">
                        {booking.persons}
                      </td>
                      <td className="py-3.5 px-5 text-xs whitespace-nowrap">
                        <span className={getStatusTextClass(booking.status)}>
                          {booking.status}
                        </span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span
                          className={
                            booking.smsConfirmed
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                          }
                        >
                          {booking.smsConfirmed
                            ? 'SMS Confirmed'
                            : 'SMS Pending'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {canCancel ? (
                          confirmCancelId === booking.id ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                disabled={cancellingId === booking.id}
                                onClick={() => handleCancelBooking(booking.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer whitespace-nowrap"
                              >
                                {cancellingId === booking.id
                                  ? 'Cancelling...'
                                  : 'Confirm Cancel'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmCancelId(null)}
                                className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                              >
                                Keep
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmCancelId(booking.id)}
                              className="text-xs font-medium text-red-600 hover:text-red-800 cursor-pointer whitespace-nowrap"
                            >
                              Cancel Booking
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
