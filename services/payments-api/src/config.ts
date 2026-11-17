export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  port: number;
  databaseUrl: string;
  rabbitmqUrl: string;
  eventsQueue: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  corsOrigin: string;
  /** Number of reverse proxies in front of the API; needed to rate limit by client IP. */
  trustProxyHops: number;
  demoUser: { id: string; email: string; password: string };
}

const MIN_SECRET_LENGTH = 32;

/** Reads configuration from the environment and fails fast when something is missing. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing required environment variable ${name}`);
    return value;
  };

  const jwtSecret = required('JWT_SECRET');
  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must have at least ${MIN_SECRET_LENGTH} characters`);
  }

  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl: required('DATABASE_URL'),
    rabbitmqUrl: required('RABBITMQ_URL'),
    eventsQueue: env.EVENTS_QUEUE?.trim() || 'payments.events',
    jwtSecret,
    jwtExpiresInSeconds: Number(env.JWT_EXPIRES_IN_SECONDS ?? 3600),
    corsOrigin: env.CORS_ORIGIN?.trim() || 'http://localhost:4200',
    trustProxyHops: Number(env.TRUST_PROXY_HOPS ?? 0),
    demoUser: {
      id: 'usr_demo',
      email: required('DEMO_USER_EMAIL').toLowerCase(),
      password: required('DEMO_USER_PASSWORD'),
    },
  };
}
