// ─── Google Drive URL Validation ──────────────────────────────────────────────
//
// Accepted domains:
//   drive.google.com
//   docs.google.com
//
// Rejected:  empty string (treated as "not provided" — always valid)
//            javascript:, data:, and any non-HTTPS scheme
//            Any domain not on the allowlist
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_GDRIVE_DOMAINS = ['drive.google.com', 'docs.google.com'];

/**
 * Validates an optional Google Drive URL.
 * Returns null if valid (including empty), or an error string.
 */
export function validateDriveUrl(raw) {
  if (!raw || !raw.trim()) return null; // optional — empty is fine

  const trimmed = raw.trim();

  // Reject dangerous schemes immediately (case-insensitive)
  const lc = trimmed.toLowerCase();
  if (lc.startsWith('javascript:') || lc.startsWith('data:') || lc.startsWith('vbscript:')) {
    return 'Unsafe URL scheme is not allowed.';
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Enter a valid URL (e.g. https://drive.google.com/…).';
  }

  if (parsed.protocol !== 'https:') {
    return 'Only HTTPS links are allowed.';
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (!ALLOWED_GDRIVE_DOMAINS.includes(hostname)) {
    return 'Only Google Drive links (drive.google.com or docs.google.com) are allowed.';
  }

  return null;
}

/**
 * Returns true if the URL is non-empty and passes validation.
 */
export function isValidDriveUrl(url) {
  return !!(url && url.trim() && validateDriveUrl(url) === null);
}
