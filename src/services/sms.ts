import { createSmsLogRecord } from '../db/queries.ts';
import { normalizeBangladeshPhone } from '../utils/phone.ts';

const BULKSMSBD_API_URL = 'http://bulksmsbd.net/api/smsapi';
const DEFAULT_SENDER_ID = '8809617623984';

export interface SmsDispatchResult {
  success: boolean;
  responseCode: string;
  statusMessage: string;
  rawResponse: string;
}

const BULKSMSBD_CODE_DESCRIPTIONS: Record<string, string> = {
  '202': 'SMS Submitted Successfully',
  '1001': 'Invalid Mobile Number',
  '1002': 'Sender ID not correct or sender ID is disabled',
  '1003': 'Required fields missing (API Key, Sender ID, Number, or Message)',
  '1005': 'BulkSMSBD Gateway Internal Error',
  '1006': 'Account Balance Validity Not Available',
  '1007': 'Insufficient SMS Account Balance',
  '1011': 'User ID not found on BulkSMSBD',
  '1012': 'Masking SMS must be sent in Bengali',
  '1013': 'Sender ID has not found Gateway by API key',
  '1014': 'Sender Type Name not found using this sender by API key',
  '1015': 'Sender ID has not found Any Valid Gateway by API key',
  '1016': 'Sender Type Name Active Price Info not found by this sender ID',
  '1017': 'Sender Type Name Price Info not found by this sender ID',
  '1018': 'The Owner of this BulkSMSBD Account is disabled',
  '1019': 'The Sender Type Price of this Account is disabled',
  '1020': 'The parent of this account is not found',
  '1021': 'The parent active price of this account is not found',
  '1031': 'BulkSMSBD Account Not Verified — Contact Administrator',
  '1032': 'Server IP Not Whitelisted in BulkSMSBD Account',
};

function parseBulkSmsResponse(rawText: string): {
  code: string;
  isSuccess: boolean;
  description: string;
} {
  const trimmed = rawText.trim();

  // Handle HTML response (e.g., 500/404 HTML or firewall page from gateway)
  if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
    return {
      code: 'GATEWAY_HTML_ERROR',
      isSuccess: false,
      description:
        'BulkSMSBD gateway returned an HTML error response. Check IP Whitelist (1032) or API Key in BulkSMSBD panel.',
    };
  }

  // Attempt JSON parse
  try {
    const parsed = JSON.parse(trimmed);
    const rawCode =
      parsed.response_code !== undefined
        ? String(parsed.response_code)
        : parsed.status_code !== undefined
        ? String(parsed.status_code)
        : '';

    if (rawCode === '202') {
      return {
        code: '202',
        isSuccess: true,
        description:
          parsed.success_message || BULKSMSBD_CODE_DESCRIPTIONS['202'],
      };
    }

    if (rawCode && BULKSMSBD_CODE_DESCRIPTIONS[rawCode]) {
      return {
        code: rawCode,
        isSuccess: false,
        description:
          parsed.error_message || BULKSMSBD_CODE_DESCRIPTIONS[rawCode],
      };
    }

    if (rawCode) {
      return {
        code: rawCode,
        isSuccess: false,
        description:
          parsed.error_message ||
          parsed.message ||
          `BulkSMSBD returned error code ${rawCode}`,
      };
    }
  } catch {
    // Plain text response fallback
  }

  if (trimmed.includes('202') || /submitted\s+successfully/i.test(trimmed)) {
    return {
      code: '202',
      isSuccess: true,
      description: BULKSMSBD_CODE_DESCRIPTIONS['202'],
    };
  }

  for (const [code, desc] of Object.entries(BULKSMSBD_CODE_DESCRIPTIONS)) {
    if (trimmed.includes(code)) {
      return {
        code,
        isSuccess: code === '202',
        description: desc,
      };
    }
  }

  return {
    code: 'UNKNOWN',
    isSuccess: false,
    description: trimmed || 'Unrecognized response from BulkSMSBD gateway',
  };
}

export function getBrandName(): string {
  return (process.env.BRAND_NAME || 'DhakaReserve').trim();
}

export function formatOtpSmsMessage(otpCode: string): string {
  const brand = getBrandName();
  return `Your ${brand} OTP is ${otpCode}`;
}

export function formatBookingConfirmationSmsMessage(params: {
  bookingId: string;
  date: string;
  time: string;
}): string {
  const brand = getBrandName();
  return `Your booking has been confirmed! Booking ID: ${params.bookingId}. Date: ${params.date}, Time: ${params.time}. Thank you for choosing ${brand}.`;
}

export async function sendSmsViaBulkSmsBd(params: {
  phone: string;
  message: string;
  messageType: 'OTP' | 'BOOKING_CONFIRMATION' | 'ADMIN_RESEND';
  bookingId?: string;
}): Promise<SmsDispatchResult> {
  const normalizedPhone = normalizeBangladeshPhone(params.phone);
  const senderId = (process.env.BULKSMSBD_SENDER_ID || DEFAULT_SENDER_ID).trim();
  const apiKey = (process.env.BULKSMSBD_API_KEY || '').trim();

  if (!normalizedPhone) {
    const result: SmsDispatchResult = {
      success: false,
      responseCode: '1001',
      statusMessage: 'Invalid Bangladesh mobile number format.',
      rawResponse: 'Validation Error: Invalid receiver number before gateway call',
    };
    await createSmsLogRecord({
      recipientPhone: params.phone,
      messageType: params.messageType,
      messageContent: params.message,
      senderId,
      status: 'FAILED',
      responseCode: result.responseCode,
      rawResponse: result.rawResponse,
      bookingId: params.bookingId,
    });
    return result;
  }

  if (!apiKey || apiKey === 'MY_BULKSMSBD_API_KEY') {
    const result: SmsDispatchResult = {
      success: false,
      responseCode: 'CONFIG_MISSING',
      statusMessage:
        'BULKSMSBD_API_KEY is not configured in server environment variables.',
      rawResponse:
        'Missing BULKSMSBD_API_KEY environment variable on backend server.',
    };
    await createSmsLogRecord({
      recipientPhone: normalizedPhone,
      messageType: params.messageType,
      messageContent: params.message,
      senderId,
      status: 'FAILED',
      responseCode: result.responseCode,
      rawResponse: result.rawResponse,
      bookingId: params.bookingId,
    });
    return result;
  }

  // BulkSMSBD POST JSON payload specification:
  // { "api_key": "your api key", "senderid": "sender id", "number": "88016xxxxxxxx", "message": "your test sms content" }
  const payload = {
    api_key: apiKey,
    senderid: senderId,
    number: normalizedPhone,
    message: params.message,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    // 1. Try POST request first as specified by BulkSMSBD JSON API docs
    let response = await fetch(BULKSMSBD_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let rawText = await response.text();
    let parsed = parseBulkSmsResponse(rawText);

    // 2. If POST method returned a 405/404 or unknown error, fallback to GET query string method
    if (!parsed.isSuccess && (parsed.code === 'UNKNOWN' || response.status >= 400)) {
      const queryString = [
        `api_key=${encodeURIComponent(apiKey)}`,
        `type=text`,
        `number=${encodeURIComponent(normalizedPhone)}`,
        `senderid=${encodeURIComponent(senderId)}`,
        `message=${encodeURIComponent(params.message)}`,
      ].join('&');

      const fallbackResponse = await fetch(`${BULKSMSBD_API_URL}?${queryString}`, {
        method: 'GET',
        signal: controller.signal,
      });

      const fallbackText = await fallbackResponse.text();
      const fallbackParsed = parseBulkSmsResponse(fallbackText);
      if (fallbackParsed.isSuccess || fallbackParsed.code !== 'UNKNOWN') {
        rawText = fallbackText;
        parsed = fallbackParsed;
      }
    }

    clearTimeout(timeout);

    const result: SmsDispatchResult = {
      success: parsed.isSuccess,
      responseCode: parsed.code,
      statusMessage: parsed.description,
      rawResponse: rawText.slice(0, 1000),
    };

    await createSmsLogRecord({
      recipientPhone: normalizedPhone,
      messageType: params.messageType,
      messageContent: params.message,
      senderId,
      status: parsed.isSuccess ? 'SENT' : 'FAILED',
      responseCode: parsed.code,
      rawResponse: rawText.slice(0, 1000),
      bookingId: params.bookingId,
    });

    return result;
  } catch (error: any) {
    const errorMsg =
      error?.name === 'AbortError'
        ? 'BulkSMSBD gateway request timed out after 15s'
        : error?.message || 'Network failure connecting to BulkSMSBD API';

    const result: SmsDispatchResult = {
      success: false,
      responseCode: 'NETWORK_ERROR',
      statusMessage: errorMsg,
      rawResponse: String(errorMsg),
    };

    await createSmsLogRecord({
      recipientPhone: normalizedPhone,
      messageType: params.messageType,
      messageContent: params.message,
      senderId,
      status: 'FAILED',
      responseCode: 'NETWORK_ERROR',
      rawResponse: String(errorMsg),
      bookingId: params.bookingId,
    });

    return result;
  }
}
