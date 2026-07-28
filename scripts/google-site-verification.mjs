import path from 'node:path';

const googleVerificationFilenamePattern = /^google[0-9a-z_-]+\.html$/i;

export function validateGoogleSiteVerificationFile(filePath, content, projectRoot) {
  const relativePath = path.relative(projectRoot, filePath);

  if (relativePath === ''
      || path.isAbsolute(relativePath)
      || relativePath.startsWith(`..${path.sep}`)
      || relativePath.includes(path.sep)
      || !googleVerificationFilenamePattern.test(relativePath)) {
    return false;
  }

  const expectedContent = `google-site-verification: ${relativePath}`;
  if (content === expectedContent
      || content === `${expectedContent}\n`
      || content === `${expectedContent}\r\n`) {
    return true;
  }

  throw new Error('Google verification file content must match its filename');
}
