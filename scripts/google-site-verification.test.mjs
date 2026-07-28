import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { validateGoogleSiteVerificationFile } from './google-site-verification.mjs';

const projectRoot = path.resolve('/project');
const verificationFilename = 'google123abc.html';
const verificationContent = `google-site-verification: ${verificationFilename}`;

test('accepts an exact Google verification file at the project root', () => {
  assert.equal(
    validateGoogleSiteVerificationFile(
      path.join(projectRoot, verificationFilename),
      verificationContent,
      projectRoot,
    ),
    true,
  );
});

test('accepts a single trailing newline in the verification file', () => {
  assert.equal(
    validateGoogleSiteVerificationFile(
      path.join(projectRoot, verificationFilename),
      `${verificationContent}\n`,
      projectRoot,
    ),
    true,
  );
});

test('does not exempt nested HTML files from site header validation', () => {
  assert.equal(
    validateGoogleSiteVerificationFile(
      path.join(projectRoot, 'nested', verificationFilename),
      verificationContent,
      projectRoot,
    ),
    false,
  );
});

test('rejects a root verification file whose content does not match', () => {
  assert.throws(
    () => validateGoogleSiteVerificationFile(
      path.join(projectRoot, verificationFilename),
      'google-site-verification: different-file.html',
      projectRoot,
    ),
    /must match its filename/,
  );
});

test('does not exempt ordinary root HTML files', () => {
  assert.equal(
    validateGoogleSiteVerificationFile(
      path.join(projectRoot, 'index.html'),
      verificationContent,
      projectRoot,
    ),
    false,
  );
});
