import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Forces every 4xx/5xx JSON response into the canonical error envelope:
 *   { error: { code, message, requestId, fields? } }
 *
 * Routes (and third-party middlewares) that still call
 * `res.status(404).json({ error: 'X' })` keep working — this wrapper
 * detects the legacy shape and rewrites it. Responses already in the
 * envelope shape pass through untouched.
 */
export const enforceErrorEnvelope: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const originalJson = res.json.bind(res);
  res.json = function patchedJson(body: unknown) {
    if (res.statusCode >= 400) {
      const wrapped = wrapErrorBody(body, res.statusCode, req.id);
      return originalJson(wrapped);
    }
    return originalJson(body);
  } as Response['json'];
  next();
};

const STATUS_TO_CODE: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'unprocessable',
  429: 'rate_limited',
  500: 'internal',
  502: 'bad_gateway',
  503: 'unavailable',
  504: 'timeout',
};

function inferCode(status: number): string {
  if (STATUS_TO_CODE[status]) return STATUS_TO_CODE[status];
  if (status >= 500) return 'internal';
  return 'bad_request';
}

function wrapErrorBody(body: unknown, status: number, requestId: string | undefined): unknown {
  const rid = requestId ?? 'unknown';
  // Already canonical envelope.
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'object' &&
    (body as { error: { code?: unknown } }).error !== null &&
    'code' in (body as { error: object }).error
  ) {
    const inner = (body as { error: Record<string, unknown> }).error;
    if (!('requestId' in inner)) inner.requestId = rid;
    return body;
  }
  // Legacy { error: 'string' } shape.
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
  ) {
    return {
      error: {
        code: inferCode(status),
        message: (body as { error: string }).error,
        requestId: rid,
      },
    };
  }
  // Legacy { message: 'string' }.
  if (
    body &&
    typeof body === 'object' &&
    'message' in body &&
    typeof (body as { message: unknown }).message === 'string'
  ) {
    return {
      error: {
        code: inferCode(status),
        message: (body as { message: string }).message,
        requestId: rid,
      },
    };
  }
  // Plain string body or anything else.
  if (typeof body === 'string') {
    return { error: { code: inferCode(status), message: body, requestId: rid } };
  }
  return {
    error: {
      code: inferCode(status),
      message: 'Request failed',
      requestId: rid,
      details: body,
    },
  };
}
