import { randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { pushKeys, validatePushKeys, type PushKeys } from '../src/push-config.ts';
import { readLocalEnv, writeLocalEnv, legacyJson, removeLegacySecret } from './local-env.ts';

// Development filesystem access is deliberately outside the runtime import
// graph so function tracers cannot bundle private local keys or backups.
export async function localPushKeys(directory: string): Promise<PushKeys> {
  const configured = await pushKeys();
  if (configured) return configured;
  const env = await readLocalEnv(directory);
  const keys = validatePushKeys((env.PARKLY_VAPID_PRIVATE_KEY ? {
    publicKey: env.PARKLY_VAPID_PUBLIC_KEY, privateKey: env.PARKLY_VAPID_PRIVATE_KEY,
    encryptionKey: env.PARKLY_PUSH_ENCRYPTION_KEY, subject: env.PARKLY_VAPID_SUBJECT,
  } : await legacyJson<PushKeys>(directory, 'push-keys.json')) || {
    ...webpush.generateVAPIDKeys(), subject: 'mailto:parkly@example.invalid', encryptionKey: randomBytes(32).toString('base64url'),
  });
  await writeLocalEnv(directory, { PARKLY_VAPID_PUBLIC_KEY: keys.publicKey, PARKLY_VAPID_PRIVATE_KEY: keys.privateKey,
    PARKLY_PUSH_ENCRYPTION_KEY: keys.encryptionKey, PARKLY_VAPID_SUBJECT: keys.subject });
  await removeLegacySecret(directory, 'push-keys.json');
  return keys;
}
