import assert from 'node:assert/strict';
import fs from 'node:fs';

const ps1 = fs.readFileSync(new URL('../../install.ps1', import.meta.url));
const sh = fs.readFileSync(new URL('../../install.sh', import.meta.url), 'utf8');

assert.deepEqual(
  Array.from(ps1.subarray(0, 3)),
  [0xef, 0xbb, 0xbf],
  'install.ps1 must stay UTF-8 with BOM for Windows PowerShell'
);

assert.ok(
  sh.startsWith('#!/usr/bin/env bash'),
  'install.sh should remain the paired bash installer'
);