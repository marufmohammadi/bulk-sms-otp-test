/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarCheck, LogOut, ShieldCheck } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { PhoneOtpAuthCard } from './components/PhoneOtpAuthCard.tsx';
import {
  BookingFormView,
  SERVICE_CATALOG,
} from './components/BookingFormView.tsx';
import { UserDashboardView } from './components/UserDashboardView.tsx';
import { AdminDashboardView } from './components/AdminDashboardView.tsx';
import { formatBangladeshPhoneDisplay } from './utils/phone.ts';
import { safeFetchJson } from './utils/api.ts';

type ActiveView = 'book' | 'dashboard' | 'services' | 'admin';

function MainWorkspace() {
  const { user, loading, logout } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('book');
  const [selectedService, setSelectedService] = useState<string>(
    SERVICE_CATALOG[0].id
  );
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [brandName, setBrandName] = useState('DhakaReserve');

  useEffect(() => {
    fetch('/api/config')
      .then((r) => safeFetchJson(r))
      .then(({ ok, data }) => {
        if (ok && data?.brandName) {
          setBrandName(data.brandName);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectServiceToBook = (serviceId: string) => {
    setSelectedService(serviceId);
    setActiveView('book');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Navigation Bar — Strict 3-Zone Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#book"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('book');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            {brandName}
          </a>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#book"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('book');
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'book'
                  ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-emerald-700'
                  : ''
              }`}
            >
              Book Appointment
            </a>
            <a
              href="#dashboard"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('dashboard');
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'dashboard'
                  ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-emerald-700'
                  : ''
              }`}
            >
              My Bookings
            </a>
            <a
              href="#services"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('services');
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'services'
                  ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-emerald-700'
                  : ''
              }`}
            >
              Service Catalog
            </a>
            <a
              href="#admin"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('admin');
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'admin'
                  ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-emerald-700'
                  : ''
              }`}
            >
              Admin Console
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => logout()}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveView('book')}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Mobile OTP Login
              </button>
            )}
          </div>
        </div>

        {/* Mobile Secondary Navigation Strip */}
        <div className="md:hidden border-t border-slate-100 px-6 py-2 flex items-center gap-5 overflow-x-auto text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveView('book')}
            className={`whitespace-nowrap shrink-0 ${
              activeView === 'book'
                ? 'text-emerald-700 font-semibold'
                : 'text-slate-600'
            }`}
          >
            Book Appointment
          </button>
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className={`whitespace-nowrap shrink-0 ${
              activeView === 'dashboard'
                ? 'text-emerald-700 font-semibold'
                : 'text-slate-600'
            }`}
          >
            My Bookings
          </button>
          <button
            type="button"
            onClick={() => setActiveView('services')}
            className={`whitespace-nowrap shrink-0 ${
              activeView === 'services'
                ? 'text-emerald-700 font-semibold'
                : 'text-slate-600'
            }`}
          >
            Service Catalog
          </button>
          <button
            type="button"
            onClick={() => setActiveView('admin')}
            className={`whitespace-nowrap shrink-0 ${
              activeView === 'admin'
                ? 'text-emerald-700 font-semibold'
                : 'text-slate-600'
            }`}
          >
            Admin Console
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-500">
            Initializing session...
          </div>
        ) : activeView === 'admin' ? (
          <AdminDashboardView />
        ) : activeView === 'services' ? (
          <div className="space-y-8">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-emerald-700">
                Reservation Categories · Dhaka & Nationwide
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
                Available Services & Booking Types
              </h1>
              <p className="text-sm text-slate-600 mt-2">
                Select any service below to proceed to the reservation form. All
                bookings include instant SMS confirmation via BulkSMSBD.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SERVICE_CATALOG.map((service, index) => (
                <div
                  key={service.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <span className="font-mono tabular-nums">
                        0{index + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{service.duration}</span>
                      <span aria-hidden="true">·</span>
                      <span>{service.capacity}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {service.name}
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      {service.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      SMS Confirmation Included
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectServiceToBook(service.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap"
                    >
                      <span>Select & Book</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !user ? (
          /* Unauthenticated View for Book / Dashboard: 2-Column Hero Split + OTP Card */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Bangladesh Mobile OTP Authentication</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Sender ID 8809617623984
                </span>
              </div>

              <h1
                className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Verified SMS Reservations with Instant Mobile Confirmation.
              </h1>

              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                Log in with your Bangladesh mobile number to book appointments,
                executive dining tables, or private conference suites. Every
                login and confirmed reservation is verified in real time via the
                BulkSMSBD SMS gateway.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">OTP Validity Window</p>
                  <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                    05:00 mins
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    60-second resend cooldown
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Supported Networks</p>
                  <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                    013 – 019
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    All BD mobile operators
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Booking Confirmation</p>
                  <p className="text-lg font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
                    Instant SMS
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unique Booking ID dispatch
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex items-center">
              <PhoneOtpAuthCard
                brandName={brandName}
                onSuccess={() => {
                  if (activeView !== 'dashboard') {
                    setActiveView('book');
                  }
                }}
              />
            </div>
          </div>
        ) : activeView === 'dashboard' ? (
          <UserDashboardView
            onNewBooking={() => setActiveView('book')}
            refreshTrigger={refreshCounter}
          />
        ) : (
          /* Authenticated Booking Form View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8">
              <BookingFormView
                initialService={selectedService}
                onBookingCreated={() => setRefreshCounter((c) => c + 1)}
                onNavigateToDashboard={() => setActiveView('dashboard')}
              />
            </div>

            <aside className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verified Account Session</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {user.fullName || 'Authenticated Guest'}
                </h3>
                <p className="text-xs font-mono text-slate-600 tabular-nums mt-1">
                  {user.phone
                    ? formatBangladeshPhoneDisplay(user.phone)
                    : user.email || 'Mobile number required on form'}
                </p>

                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>SMS Gateway</span>
                    <span className="font-medium text-slate-900">
                      BulkSMSBD API
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Sender ID</span>
                    <span className="font-mono tabular-nums text-slate-900">
                      8809617623984
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveView('dashboard')}
                    className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>View My Booking History</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} {brandName}. Powered by BulkSMSBD SMS
            Gateway & PostgreSQL.
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveView('book')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Book Appointment
            </button>
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              My Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveView('admin')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Admin Console
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainWorkspace />
    </AuthProvider>
  );
}
