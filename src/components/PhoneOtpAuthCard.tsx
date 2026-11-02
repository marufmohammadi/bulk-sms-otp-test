import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Phone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { safeFetchJson } from '../utils/api.ts';
import {
  formatBangladeshPhoneDisplay,
  isValidBangladeshPhone,
  normalizeBangladeshPhone,
} from '../utils/phone.ts';

interface PhoneOtpAuthCardProps {
  onSuccess?: () => void;
  brandName?: string;
}

export const PhoneOtpAuthCard: React.FC<PhoneOtpAuthCardProps> = ({
  onSuccess,
  brandName = 'DhakaReserve',
}) => {
  const { setOtpSession, signInWithGoogle } = useAuth();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [otpInput, setOtpInput] = useState('');

  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Cooldown timer (60 seconds)
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // OTP Expiration timer (5 minutes = 300 seconds)
  useEffect(() => {
    if (expirySeconds <= 0) return;
    const timer = setInterval(() => {
      setExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [expirySeconds]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!isValidBangladeshPhone(phoneInput)) {
      setErrorMessage(
        'Please enter a valid 11-digit Bangladesh mobile number (e.g., 01712345678 or +8801712345678).'
      );
      return;
    }

    const normalized = normalizeBangladeshPhone(phoneInput)!;
    setSendingOtp(true);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      });

      const { ok, data } = await safeFetchJson(res);

      if (data.cooldownRemaining) {
        setCooldownSeconds(Number(data.cooldownRemaining));
      } else if (data.cooldownSeconds) {
        setCooldownSeconds(Number(data.cooldownSeconds));
      }

      if (!ok) {
        setErrorMessage(
          data.error || 'Unable to send OTP via BulkSMSBD. Please try again.'
        );
        return;
      }

      setStep('otp');
      setOtpInput('');
      setExpirySeconds(data.expiresInSeconds || 300);
      setCooldownSeconds(data.cooldownSeconds || 60);
      setInfoMessage(
        data.message ||
          `OTP sent to ${formatBangladeshPhoneDisplay(normalized)} via BulkSMSBD.`
      );
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Network error while requesting OTP. Please try again.'
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanedOtp = otpInput.replace(/\D/g, '');
    if (cleanedOtp.length < 4 || cleanedOtp.length > 6) {
      setErrorMessage('Please enter the 6-digit OTP sent to your mobile.');
      return;
    }

    if (expirySeconds <= 0) {
      setErrorMessage(
        'Your OTP has expired after 5 minutes. Please click Resend OTP to receive a new code.'
      );
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneInput,
          otp: cleanedOtp,
          fullName: fullNameInput.trim() || undefined,
        }),
      });

      const { ok, data } = await safeFetchJson(res);
      if (!ok) {
        setErrorMessage(data.error || 'OTP verification failed.');
        return;
      }

      setOtpSession(data.token, data.user);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Network error while verifying OTP. Please try again.'
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Google Sign-In could not be completed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 max-w-md w-full mx-auto">
      <div className="mb-6">
        <p className="text-xs font-medium text-emerald-700 mb-1">
          Mobile Verification · BulkSMSBD Gateway
        </p>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {step === 'phone'
            ? `Sign in to ${brandName}`
            : 'Enter verification code'}
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          {step === 'phone'
            ? 'Enter your Bangladesh mobile number to receive a 6-digit one-time passcode via SMS.'
            : `We dispatched a 6-digit OTP to ${formatBangladeshPhoneDisplay(
                phoneInput
              )}.`}
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {infoMessage && !errorMessage && (
        <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{infoMessage}</div>
        </div>
      )}

      {step === 'phone' ? (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div>
            <label
              htmlFor="auth-fullname"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Full Name <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="auth-fullname"
              type="text"
              value={fullNameInput}
              onChange={(e) => setFullNameInput(e.target.value)}
              placeholder="e.g., Tanvir Ahmed"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          <div>
            <label
              htmlFor="auth-phone"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Bangladesh Mobile Number <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="auth-phone"
                type="tel"
                required
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="01712345678 or +8801712345678"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Supports Grameenphone, Robi, Banglalink, Airtel & Teletalk (013–019).
            </p>
          </div>

          <button
            type="submit"
            disabled={sendingOtp || cooldownSeconds > 0}
            className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {sendingOtp ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending OTP via BulkSMSBD...</span>
              </>
            ) : cooldownSeconds > 0 ? (
              <span className="font-mono tabular-nums">
                Wait {cooldownSeconds}s to request OTP
              </span>
            ) : (
              <>
                <span>Send 6-Digit OTP</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="auth-otp"
                className="block text-xs font-semibold text-slate-700"
              >
                6-Digit OTP Code
              </label>
              <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {expirySeconds > 0
                  ? `Expires in ${formatTimer(expirySeconds)}`
                  : 'OTP Expired'}
              </span>
            </div>
            <input
              id="auth-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full px-4 py-3 text-center text-xl font-mono tabular-nums tracking-[0.35em] bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={verifyingOtp || expirySeconds <= 0}
            className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {verifyingOtp ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying OTP...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Verify & Sign In</span>
              </>
            )}
          </button>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className="text-slate-600 hover:text-slate-900 font-medium cursor-pointer whitespace-nowrap"
            >
              Change number
            </button>

            <button
              type="button"
              disabled={sendingOtp || cooldownSeconds > 0}
              onClick={() => handleRequestOtp()}
              className="inline-flex items-center gap-1.5 font-medium text-emerald-700 hover:text-emerald-800 disabled:text-slate-400 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${sendingOtp ? 'animate-spin' : ''}`}
              />
              {cooldownSeconds > 0 ? (
                <span className="font-mono tabular-nums">
                  Resend in {cooldownSeconds}s
                </span>
              ) : (
                <span>Resend OTP</span>
              )}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 pt-5 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
          <span>Alternative Account Access</span>
          <span>Google OAuth</span>
        </div>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full py-2 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          ) : (
            <span>Continue with Google Account</span>
          )}
        </button>
      </div>
    </div>
  );
};
