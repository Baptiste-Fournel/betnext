/**
 * Options de connexion BullMQ (ioredis) dérivées d'une URL Redis.
 *
 * `host`/`port` sont garantis ; `username`/`password`/`tls` sont propagés s'ils sont présents
 * dans l'URL. Forme structurellement compatible avec les options de connexion de BullMQ.
 */
export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
}

/**
 * Construit les options de connexion BullMQ à partir d'une URL Redis.
 *
 * Les Redis managés (Railway, Upstash…) protègent l'instance par mot de passe et exposent
 * parfois un endpoint TLS (`rediss://`). Une connexion réduite à `{ host, port }` échoue alors
 * à l'authentification (NOAUTH). On propage donc username / password / TLS depuis l'URL.
 *
 * En local (`redis://host:port` sans identifiants), le résultat est identique à l'ancien
 * `{ host, port }` — comportement inchangé pour la démo et la CI.
 */
export function redisConnectionFromUrl(redisUrl: string): RedisConnectionOptions {
  const url = new URL(redisUrl);
  const connection: RedisConnectionOptions = {
    host: url.hostname,
    port: Number(url.port || 6379),
  };
  if (url.username) {
    connection.username = decodeURIComponent(url.username);
  }
  if (url.password) {
    connection.password = decodeURIComponent(url.password);
  }
  if (url.protocol === 'rediss:') {
    connection.tls = {};
  }
  return connection;
}
