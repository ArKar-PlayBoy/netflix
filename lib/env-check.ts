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

  if (problems.length > 0) {
    console.error(
      "[SECURITY] Refusing unsafe production config:\n  - " +
        problems.join("\n  - ") +
        "\nGenerate secrets with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\""
    );
  }
}
