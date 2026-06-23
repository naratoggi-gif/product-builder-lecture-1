import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { appVersion } from './app-version';
import { ConsoleErrorReporter } from './error-reporter';

type RequestWithUser = Request & {
  requestId?: string;
  user?: { sub?: number; userId?: number };
};

const SENSITIVE_PATH_PARTS = ['password', 'token', 'authorization', 'jwt'];
const errorReporter = new ConsoleErrorReporter();

function sanitizePath(path: string): string {
  return path.replace(/[?].*$/, '');
}

function safeUserId(request: RequestWithUser): number | null {
  return Number(request.user?.sub || request.user?.userId) || null;
}

export function safeRequestLogger(request: RequestWithUser, response: Response, next: NextFunction): void {
  const startedAt = Date.now();
  const requestId = request.header('x-request-id') || randomUUID();
  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);

  response.on('finish', () => {
    const path = sanitizePath(request.originalUrl || request.url || '');
    if (SENSITIVE_PATH_PARTS.some((part) => path.toLowerCase().includes(part))) return;
    const timestamp = new Date().toISOString();
    const entry = {
      requestId,
      method: request.method,
      path,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
      userId: safeUserId(request),
      appVersion: appVersion(),
      environment: process.env.NODE_ENV || 'development',
      timestamp,
    };
    process.stdout.write(`${JSON.stringify(entry)}\n`);
    if (response.statusCode >= 500) {
      void errorReporter.report({
        requestId,
        path,
        statusCode: response.statusCode,
        appVersion: entry.appVersion,
        environment: entry.environment,
        occurredAt: timestamp,
      });
    }
  });

  next();
}
