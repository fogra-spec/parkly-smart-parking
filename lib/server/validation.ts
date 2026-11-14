import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const timestamp = z.number().int().nonnegative().safe();
const idempotencyKey = z.string().uuid().optional();
export const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('login'), role: z.enum(['driver', 'operator', 'operator-east', 'admin']).default('driver') }).strict(),
  z.object({ action: z.literal('logout') }).strict(),
  z.object({ action: z.literal('book'), id, start: timestamp, end: timestamp,
    quotedPrice: z.number().int().min(0).max(100_000).optional(), idempotencyKey }).strict(),
  z.object({ action: z.literal('cancel'), id }).strict(),
  z.object({ action: z.literal('complete'), id }).strict(),
  z.object({ action: z.literal('operatorCancel'), id }).strict(),
  z.object({ action: z.literal('favorite'), id, enabled: z.boolean() }).strict(),
  z.object({ action: z.literal('inventory'), id,
    capacity: z.number().int().min(0).max(10_000), price: z.number().int().min(0).max(100_000) }).strict(),
  z.object({ action: z.literal('approval'), id, enabled: z.boolean() }).strict(),
  z.object({ action: z.literal('user'), id, enabled: z.boolean() }).strict(),
  z.object({ action: z.literal('profile'), name: z.string().trim().min(2).max(60) }).strict(),
]);
export type Action = z.infer<typeof actionSchema>;

export function validateMutationRequest(req: Request): string | null {
  const origin = req.headers.get('origin');
  if ((origin && origin !== new URL(req.url).origin) || req.headers.get('sec-fetch-site') === 'cross-site') {
    return 'Invalid request origin.';
  }
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return 'Use application/json.';
  }
  return null;
}
