import { redisConnectionFromUrl } from './redisConnection';

describe('redisConnectionFromUrl', () => {
  it('shouldReturnHostAndPortOnly_WhenUrlHasNoCredentials', () => {
    expect(redisConnectionFromUrl('redis://localhost:6379')).toEqual({
      host: 'localhost',
      port: 6379,
    });
  });

  it('shouldDefaultPortTo6379_WhenUrlOmitsPort', () => {
    expect(redisConnectionFromUrl('redis://cache.internal')).toEqual({
      host: 'cache.internal',
      port: 6379,
    });
  });

  it('shouldPropagatePassword_WhenManagedRedisRequiresAuth', () => {
    expect(redisConnectionFromUrl('redis://default:s3cr3t@host.railway.internal:6380')).toEqual({
      host: 'host.railway.internal',
      port: 6380,
      username: 'default',
      password: 's3cr3t',
    });
  });

  it('shouldDecodeAndEnableTls_WhenUrlUsesRedissWithEncodedPassword', () => {
    expect(redisConnectionFromUrl('rediss://user:p%40ss@host:6390')).toEqual({
      host: 'host',
      port: 6390,
      username: 'user',
      password: 'p@ss',
      tls: {},
    });
  });
});
