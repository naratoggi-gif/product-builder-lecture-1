# StepQuest Security Audit

Generated for `v0.1.1-alpha` staging readiness.

## Commands

```bash
npm run audit:reports
npm run audit:ci
```

`npm audit fix --force` is intentionally not used because it can cross major-version boundaries.

## GitHub Dependency Monitoring

`.github/dependabot.yml` schedules weekly update PRs for `backend/package-lock.json` and GitHub Actions.

Before opening the closed alpha:

1. Enable Dependabot alerts in GitHub repository settings.
2. Confirm Dependabot security updates are enabled.
3. Treat any new Critical or High production alert as a staging release blocker unless it is documented here with a closed-alpha exception.

## Production Findings

| Package | Severity | Dependency Type | Execution Path | Fix Status | Decision |
| --- | --- | --- | --- | --- | --- |
| `multer` | High | Transitive via `@nestjs/platform-express` | No active file upload or multipart routes in StepQuest | npm reports only a breaking forced path | Temporary exception for closed alpha |

## Risk Notes

- StepQuest currently accepts JSON API requests and static assets only.
- No route uses Nest file interceptors, `multer`, or multipart upload parsing.
- This exception must be revisited before adding profile images, attachments, imports, or any multipart endpoint.
- CI fails for new high/critical production vulnerabilities unless they are explicitly classified here and in `scripts/audit-ci.js`.

## Dev/Transitive Findings

Moderate dev/transitive findings remain possible in build and test tooling. They are tracked separately from production exposure and should be reviewed before widening the alpha.
