#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function writeReport(filename, args) {
  const result = spawnSync(npm, args, { encoding: 'utf8' });
  fs.writeFileSync(filename, result.stdout || '{}');
  if (result.stderr) process.stderr.write(result.stderr);
}

writeReport('audit-all.json', ['audit', '--json']);
writeReport('audit-production.json', ['audit', '--omit=dev', '--json']);
writeReport('audit-fix-plan.json', ['audit', 'fix', '--dry-run', '--json']);
process.stdout.write('Audit reports written: audit-all.json, audit-production.json, audit-fix-plan.json\n');
