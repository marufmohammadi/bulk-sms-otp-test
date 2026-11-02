export interface UserProfile {
  id: number;
  uid: string;
  phone: string | null;
  fullName: string | null;
  email: string;
  role: string;
  isVerified: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface BookingRecord {
  id: number;
  bookingId: string;
  userId: number;
  fullName: string;
  phone: string;
  bookingDate: string;
  bookingTime: string;
  persons: number;
  serviceType: string;
  notes: string | null;
  status: 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed';
  smsConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmsLogRecord {
  id: number;
  recipientPhone: string;
  messageType: 'OTP' | 'BOOKING_CONFIRMATION' | 'ADMIN_RESEND' | string;
  messageContent: string;
  senderId: string;
  status: 'SENT' | 'FAILED' | string;
  responseCode: string | null;
  rawResponse: string | null;
  bookingId: string | null;
  createdAt: string;
}

export interface GatewayConfigInfo {
  provider: string;
  endpoint: string;
  senderId: string;
  brandName: string;
  apiKeyConfigured: boolean;
}
