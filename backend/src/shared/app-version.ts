export const DEFAULT_APP_VERSION = '0.1.1-alpha';

export function appVersion(): string {
  return process.env.APP_VERSION || DEFAULT_APP_VERSION;
}

export function commitSha(): string {
  return process.env.GIT_COMMIT_SHA
    || process.env.RENDER_GIT_COMMIT
    || process.env.GIT_SHA
    || process.env.COMMIT_SHA
    || 'local';
}
