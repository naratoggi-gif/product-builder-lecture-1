export type AppErrorEvent = {
  requestId?: string;
  path?: string;
  statusCode?: number;
  appVersion: string;
  environment: string;
  occurredAt: string;
};

export interface ErrorReporter {
  report(event: AppErrorEvent): void | Promise<void>;
}

export class ConsoleErrorReporter implements ErrorReporter {
  report(event: AppErrorEvent): void {
    process.stderr.write(`${JSON.stringify({ type: 'app_error', ...event })}\n`);
  }
}
