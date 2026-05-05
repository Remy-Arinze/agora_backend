import { BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';

/** Client-facing SSE `error` event payload (Lois chat stream). */
export type LoisStreamErrorPayload = {
  code: LoisStreamErrorCode;
  message: string;
  title?: string;
};

export type LoisStreamErrorCode =
  | 'LOIS_UNAVAILABLE'
  | 'LOIS_RATE_LIMIT'
  | 'LOIS_CONTEXT_LENGTH'
  | 'LOIS_PROVIDER'
  | 'LOIS_CREDITS'
  | 'LOIS_PERMISSION'
  | 'LOIS_VALIDATION'
  | 'LOIS_UNKNOWN';

/**
 * Map thrown errors / provider errors to safe client payloads (no stack traces, tokens, or URLs).
 */
export function toLoisStreamErrorPayload(err: unknown): LoisStreamErrorPayload {
  if (err instanceof ForbiddenException) {
    const res = err.getResponse();
    const msg =
      typeof res === 'string' ? res : (res as { message?: string | string[] })?.message;
    const text = Array.isArray(msg) ? msg.join(' ') : msg || 'You do not have permission for this action.';
    return { code: 'LOIS_PERMISSION', message: text, title: 'Permission needed' };
  }

  if (err instanceof BadRequestException) {
    const res = err.getResponse();
    const msg =
      typeof res === 'string' ? res : (res as { message?: string | string[] })?.message;
    const text = Array.isArray(msg) ? msg.join(' ') : msg || 'This request could not be completed.';
    const lower = text.toLowerCase();
    if (
      lower.includes('credit') ||
      lower.includes('subscription') ||
      lower.includes('upgrade') ||
      lower.includes('does not have access to agora ai')
    ) {
      return { code: 'LOIS_CREDITS', message: text, title: 'Credits or plan' };
    }
    if (lower.includes('openai') && (lower.includes('not configured') || lower.includes('api'))) {
      return { code: 'LOIS_UNAVAILABLE', message: text, title: 'AI unavailable' };
    }
    return { code: 'LOIS_VALIDATION', message: text, title: 'Request issue' };
  }

  if (err instanceof HttpException) {
    const res = err.getResponse();
    const msg =
      typeof res === 'string' ? res : (res as { message?: string | string[] })?.message;
    const text = Array.isArray(msg) ? msg.join(' ') : msg || 'Something went wrong.';
    return { code: 'LOIS_UNKNOWN', message: text, title: 'Unable to continue' };
  }

  const anyErr = err as { status?: number; code?: string; message?: string; error?: { message?: string } };
  const message = anyErr?.message || anyErr?.error?.message || '';
  const lower = message.toLowerCase();

  if (anyErr?.status === 429 || lower.includes('rate limit')) {
    return {
      code: 'LOIS_RATE_LIMIT',
      message: 'The AI service is busy right now. Please wait a few seconds and try again.',
      title: 'Too many requests',
    };
  }

  if (
    lower.includes('context length') ||
    lower.includes('maximum context') ||
    lower.includes('token') && lower.includes('limit')
  ) {
    return {
      code: 'LOIS_CONTEXT_LENGTH',
      message: 'This conversation is too long for one reply. Start a new chat or send a shorter message.',
      title: 'Message too long',
    };
  }

  if (lower.includes('insufficient') && lower.includes('credit')) {
    return {
      code: 'LOIS_CREDITS',
      message: message || 'AI credits are exhausted for your school. Please top up or upgrade.',
      title: 'Credits',
    };
  }

  if (lower.includes('not configured') || lower.includes('api key')) {
    return {
      code: 'LOIS_UNAVAILABLE',
      message: 'Lois is not configured on this server. Please contact your administrator.',
      title: 'AI unavailable',
    };
  }

  return {
    code: 'LOIS_PROVIDER',
    message:
      'Lois hit a temporary problem. Please try again in a moment. If it keeps happening, contact support.',
    title: 'Something went wrong',
  };
}
