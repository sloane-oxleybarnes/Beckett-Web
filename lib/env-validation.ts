type Environment = Readonly<Record<string, string | undefined>>;

export function requireEnvValue(environment: Environment, name: string) {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function requireHttpUrl(environment: Environment, name: string) {
  const value = requireEnvValue(environment, name);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Environment variable ${name} must be a valid URL`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Environment variable ${name} must use http or https`);
  }

  return parsed.origin;
}
