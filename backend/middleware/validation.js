const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidUUID(str) {
  if (typeof str !== "string") return false;
  return UUID_REGEX.test(str);
}

export function isValidDate(str) {
  if (typeof str !== "string" || !DATE_REGEX.test(str)) return false;
  const [year, month, day] = str.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

export function isValidYear(year) {
  const num = typeof year === "number" ? year : parseInt(year, 10);
  return Number.isInteger(num) && num >= 1970 && num <= 2100;
}

/**
 * Express middleware to validate UUID route parameter (e.g. :id)
 */
export function validateUUIDParam(paramName = "id") {
  return (req, res, next) => {
    const val = req.params[paramName];
    if (!val || !isValidUUID(val)) {
      return res.status(400).json({ error: `Invalid ${paramName} format: must be a valid UUID` });
    }
    next();
  };
}

export function sanitizeTitle(title, maxLen = 500) {
  if (typeof title !== "string") return null;
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}
