/**
 * Comprehensive security headers middleware (inspired by Helmet).
 * Provides defense-in-depth against XSS, clickjacking, MIME-sniffing, and protocol downgrades.
 */
export function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent Clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Modern browser XSS filter standard
  res.setHeader("X-XSS-Protection", "0");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Cross-Origin policies
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  // Enforce HTTPS
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  // Restrict sensitive browser features
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://*.supabase.co https://*.supabase.in; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );

  next();
}
