import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { safeFetchJson } from '../utils/api.ts';
import {
  BookingRecord,
  GatewayConfigInfo,
  SmsLogRecord,
  UserProfile,
} from '../types.ts';
import { formatBangladeshPhoneDisplay } from '../utils/phone.ts';

export const AdminDashboardView: React.FC = () => {
  const { adminToken, setAdminSession } = useAuth();

  // Admin Login Form State
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin Data State
  const [activeTab, setActiveTab] = useState<'bookings' | 'users' | 'sms_logs'>(
    'bookings'
  );
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsLogRecord[]>([]);
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfigInfo | null>(
    null
  );

  const [loadingData, setLoadingData] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Filters for Bookings
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Action Loading trackers
  const [updatingBookingId, setUpdatingBookingId] = useState<number | null>(
    null
  );
  const [resendingSmsBookingId, setResendingSmsBookingId] = useState<
    number | null
  >(null);

  const fetchAdminOverview = async (tokenToUse?: string) => {
    const activeToken = tokenToUse || adminToken;
    if (!activeToken) return;

    setLoadingData(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });
      if (res.status === 401 || res.status === 403) {
        setAdminSession(null);
        return;
      }
      const { ok, data } = await safeFetchJson(res);
      if (!ok) {
        throw new Error(data.error || 'Failed to load admin overview.');
      }
      setBookings(data.bookings || []);
      setUsers(data.users || []);
      setSmsLogs(data.smsLogs || []);
      setGatewayConfig(data.gatewayConfig || null);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Could not load admin dashboard data.',
      });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetchAdminOverview(adminToken);
    }
  }, [adminToken]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const { ok, data } = await safeFetchJson(res);
      if (!ok) {
        setLoginError(data.error || 'Invalid admin credentials.');
        return;
      }
      setAdminSession(data.token);
      fetchAdminOverview(data.token);
    } catch (err: any) {
      setLoginError(err.message || 'Network error during admin sign-in.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleUpdateBookingStatus = async (
    bookingId: number,
    newStatus: BookingRecord['status']
  ) => {
    if (!adminToken) return;
    setUpdatingBookingId(bookingId);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const { ok, data } = await safeFetchJson(res);
      if (!ok) {
        throw new Error(data.error || 'Failed to update status.');
      }
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? data.booking : b))
      );
      setActionFeedback({
        type: 'success',
        message: `Booking ${data.booking.bookingId} status updated to ${newStatus}.`,
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to update booking status.',
      });
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const handleResendConfirmationSms = async (booking: BookingRecord) => {
    if (!adminToken) return;
    setResendingSmsBookingId(booking.id);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/resend-sms`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const { ok, data } = await safeFetchJson(res);
      if (data.booking) {
        setBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? data.booking : b))
        );
      }
      // Refresh SMS logs so the new entry appears immediately
      fetchAdminOverview(adminToken);

      if (!ok) {
        setActionFeedback({
          type: 'error',
          message:
            data.error ||
            `SMS delivery failed for ${booking.bookingId}. Check SMS Logs tab for API response.`,
        });
        return;
      }

      setActionFeedback({
        type: 'success',
        message: `Confirmation SMS dispatched to ${formatBangladeshPhoneDisplay(
          booking.phone
        )} for Booking ${booking.bookingId} (Code ${data.smsResult?.code}).`,
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to resend confirmation SMS.',
      });
    } finally {
      setResendingSmsBookingId(null);
    }
  };

  if (!adminToken) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 max-w-md mx-auto">
        <div className="mb-6">
          <p className="text-xs font-medium text-slate-500">
            Restricted Access · Operations Console
          </p>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
            Admin Console Sign In
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Sign in with administrator credentials to manage bookings, users,
            and BulkSMSBD gateway logs.
          </p>
        </div>

        {loginError && (
          <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label
              htmlFor="admin-username"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Admin Username
            </label>
            <input
              id="admin-username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Admin Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('admin123');
                }}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Fill default (admin / admin123)
              </button>
            </div>
            <input
              id="admin-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {loginLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Access Admin Console</span>
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.bookingId.toLowerCase().includes(q) ||
      b.phone.toLowerCase().includes(q) ||
      b.fullName.toLowerCase().includes(q);
    const matchesDate = !dateFilter || b.bookingDate === dateFilter;
    const matchesStatus =
      statusFilter === 'ALL' || b.status.toUpperCase() === statusFilter;
    return matchesSearch && matchesDate && matchesStatus;
  });

  const sentSmsCount = smsLogs.filter((l) => l.status === 'SENT').length;
  const failedSmsCount = smsLogs.filter((l) => l.status === 'FAILED').length;

  return (
    <div className="space-y-8">
      {/* Admin Top Header & KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Administration Console</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Sender ID: {gatewayConfig?.senderId || '8809617623984'}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  gatewayConfig?.apiKeyConfigured
                    ? 'text-emerald-700 font-medium'
                    : 'text-amber-700 font-medium'
                }
              >
                {gatewayConfig?.apiKeyConfigured
                  ? 'BulkSMSBD API Key Active'
                  : 'BULKSMSBD_API_KEY Not Configured'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Bookings, Users & SMS Gateway Logs
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchAdminOverview()}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`}
              />
              <span>Refresh Data</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminSession(null)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Lock Admin
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-5">
          <div>
            <p className="text-xs text-slate-500">Total Bookings</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {bookings.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Confirmed Bookings</p>
            <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
              {bookings.filter((b) => b.status === 'Confirmed').length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Registered Users</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {users.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">SMS Dispatches (Sent / Failed)</p>
            <p className="text-2xl font-bold font-mono tabular-nums mt-0.5">
              <span className="text-emerald-700">{sentSmsCount}</span>
              <span className="text-slate-300 mx-1.5">/</span>
              <span className="text-red-600">{failedSmsCount}</span>
            </p>
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-xs font-semibold underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Tabbed Workspace */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'bookings'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Bookings ({bookings.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'users'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Registered Users ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sms_logs')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'sms_logs'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SMS Gateway Logs ({smsLogs.length})
            </button>
          </div>

          {activeTab === 'bookings' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-60">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search phone or Booking ID..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="COMPLETED">Completed</option>
              </select>

              {(searchQuery || dateFilter || statusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setDateFilter('');
                    setStatusFilter('ALL');
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* TAB 1: ALL BOOKINGS */}
        {activeTab === 'bookings' && (
          <div className="overflow-x-auto">
            {filteredBookings.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No bookings match the selected search or filter criteria.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4 whitespace-nowrap">Booking ID</th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      Customer & Phone
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      Service & Party
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">Date & Time</th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      SMS Confirmation
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      Update Status
                    </th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">
                      SMS Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredBookings.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {b.bookingId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">
                          {b.fullName}
                        </div>
                        <div className="font-mono text-xs text-slate-600 tabular-nums">
                          {formatBangladeshPhoneDisplay(b.phone)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-900 text-xs font-medium">
                          {b.serviceType}
                        </div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono tabular-nums">
                            {b.persons}
                          </span>{' '}
                          {b.persons === 1 ? 'person' : 'persons'}
                          {b.notes ? ` · ${b.notes}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        <div>{b.bookingDate}</div>
                        <div className="text-slate-500">{b.bookingTime}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            b.smsConfirmed
                              ? 'text-emerald-700 font-semibold'
                              : 'text-amber-700 font-medium'
                          }
                        >
                          {b.smsConfirmed
                            ? 'Delivered (202)'
                            : 'Not Confirmed'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          disabled={updatingBookingId === b.id}
                          value={b.status}
                          onChange={(e) =>
                            handleUpdateBookingStatus(
                              b.id,
                              e.target.value as BookingRecord['status']
                            )
                          }
                          className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={resendingSmsBookingId === b.id}
                          onClick={() => handleResendConfirmationSms(b)}
                          className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          {resendingSmsBookingId === b.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Resend SMS</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: REGISTERED USERS */}
        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            {users.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No registered users found in database.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-5 whitespace-nowrap">User ID</th>
                    <th className="py-3 px-5 whitespace-nowrap">Full Name</th>
                    <th className="py-3 px-5 whitespace-nowrap">
                      Mobile Number
                    </th>
                    <th className="py-3 px-5 whitespace-nowrap">
                      Verification & Role
                    </th>
                    <th className="py-3 px-5 whitespace-nowrap">Last Login</th>
                    <th className="py-3 px-5 whitespace-nowrap">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-5 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        #{u.id}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-slate-900">
                        {u.fullName || '—'}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-slate-900 tabular-nums whitespace-nowrap">
                        {u.phone
                          ? formatBangladeshPhoneDisplay(u.phone)
                          : u.email || '—'}
                      </td>
                      <td className="py-3.5 px-5 text-xs whitespace-nowrap">
                        <span
                          className={
                            u.isVerified
                              ? 'text-emerald-700 font-semibold'
                              : 'text-slate-500'
                          }
                        >
                          {u.isVerified ? 'OTP Verified' : 'Unverified'}
                        </span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="text-slate-600">{u.role}</span>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: SMS LOGS & API RESPONSES */}
        {activeTab === 'sms_logs' && (
          <div className="overflow-x-auto">
            {smsLogs.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No SMS dispatch logs recorded yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4 whitespace-nowrap">Timestamp</th>
                    <th className="py-3 px-4 whitespace-nowrap">Type</th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      Recipient & Sender ID
                    </th>
                    <th className="py-3 px-4">Message Content</th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      Status & Code
                    </th>
                    <th className="py-3 px-4">BulkSMSBD Raw Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {smsLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {log.messageType}
                        {log.bookingId && (
                          <div className="text-slate-500 font-normal tabular-nums mt-0.5">
                            {log.bookingId}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-900 font-medium">
                          {formatBangladeshPhoneDisplay(log.recipientPhone)}
                        </div>
                        <div className="text-slate-500">
                          From: {log.senderId}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 max-w-xs">
                        {log.messageContent}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={
                            log.status === 'SENT'
                              ? 'text-emerald-700 font-semibold'
                              : 'text-red-600 font-semibold'
                          }
                        >
                          {log.status}
                        </span>
                        <span className="mx-1 text-slate-300">·</span>
                        <span className="text-slate-700">
                          Code: {log.responseCode || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 max-w-xs break-all">
                        {log.rawResponse || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
