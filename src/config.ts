/**
 * Application configuration with environment validation
 * Note: For Cloudflare Workers, environment variables come from wrangler.toml
 */

export interface Config {
  environment: string;
  corsOrigins: string[];
}

/**
 * Validate and get configuration based on environment
 */
export function validateConfig(): Config {
  const corsOrigins = [
    "http://localhost:3000",
    "http://localhost:8787",
    "https://yourdomain.com",
  ];

  // Add production origins based on environment
  // Environment is passed via wrangler.toml bindings
  corsOrigins.push("https://karnarupa.com");
  corsOrigins.push("https://www.karnarupa.com");

  const config: Config = {
    environment: "development", // Will be overridden by Bindings.ENVIRONMENT
    corsOrigins,
  };

  console.log(`Configuration loaded`);
  return config;
}

/**
 * Get current configuration
 */
let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = validateConfig();
  }
  return _config;
}
