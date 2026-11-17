export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  port: number;
  mongodbUrl: string;
  rabbitmqUrl: string;
  eventsQueue: string;
  jwtSecret: string;
  corsOrigin: string;
}

/** Reads configuration from the environment and fails fast when something is missing. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing required environment variable ${name}`);
    return value;
  };

  return {
    port: Number(env.PORT ?? 3002),
    mongodbUrl: required('MONGODB_URL'),
    rabbitmqUrl: required('RABBITMQ_URL'),
    eventsQueue: env.EVENTS_QUEUE?.trim() || 'payments.events',
    jwtSecret: required('JWT_SECRET'),
    corsOrigin: env.CORS_ORIGIN?.trim() || 'http://localhost:4200',
  };
}
