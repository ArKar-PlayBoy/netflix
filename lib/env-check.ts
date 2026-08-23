const WEAK_DEFAULTS = [
  "default-secret-change-me",
  "admin-session-secret-change-me",
  "user-session-secret-change-me",
];

let checked = false;

export function validateSecrets(): void {
  if (checked) return;
  checked = true;

  if (process.env.NODE_ENV !== "production") return;

  const problems: string[] = [];

  for (const name of ["STREAM_SECRET", "SESSION_SECRET"]) {
    const value = process.env[name];
    if (!value) {
      problems.push(`${name} is not set`);
    } else if (WEAK_DEFAULTS.includes(value) || value.length < 32) {
      problems.push(`${name} is weak (use a 32+ char random string)`);
    }
  }

  // lib/crypto.ts falls back to a constant derived from this public repo when
  // the whole key chain is empty — that would make stored-email crypto and
  // hmac lookups forgeable by anyone who reads the source.
  const cryptoKey = process.env.DATA_ENCRYPTION_KEY || process.env.SESSION_SECRET || process.env.STREAM_SECRET;
  if (!cryptoKey) {
    problems.push(
      "No encryption key (DATA_ENCRYPTION_KEY / SESSION_SECRET / STREAM_SECRET) — user-email crypto would use a public constant"
    );
  } else if (cryptoKey.length < 32) {
    problems.push("Encryption key chain is weak (use a 32+ char random string)");
  }

  if (problems.length > 0) {
    const message =
      "[SECURITY] Refusing unsafe production config:\n  - " +
      problems.join("\n  - ") +
      "\nGenerate secrets with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"";
    console.error(message);
    // Fail closed: a misconfigured production deployment must not run with
    // forgeable session tokens / publicly-derivable crypto keys.
    throw new Error("Unsafe production configuration — see server logs");
  }
}
