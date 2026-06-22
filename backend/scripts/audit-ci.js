#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const result = spawnSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['audit', '--omit=dev', '--audit-level=high', '--json'],
  { encoding: 'utf8' },
);

const output = result.stdout || '{}';
fs.writeFileSync('audit-production.json', output);

let report;
try {
  report = JSON.parse(output);
} catch (error) {
  process.stderr.write(result.stderr || String(error));
  process.exit(1);
}

const allowed = new Set(['multer']);
const blocking = Object.entries(report.vulnerabilities || {}).filter(([name, vulnerability]) => {
  const severity = vulnerability.severity;
  if (severity !== 'high' && severity !== 'critical') return false;
  return !allowed.has(name);
});

if (blocking.length > 0) {
  process.stderr.write(JSON.stringify({ blockingAuditFindings: blocking.map(([name]) => name) }, null, 2));
  process.exit(1);
}

if (report.vulnerabilities?.multer) {
  process.stdout.write('Known production audit exception: multer is pulled by @nestjs/platform-express, but StepQuest exposes no file-upload or multipart routes.\n');
}
process.stdout.write('Production audit gate passed.\n');
