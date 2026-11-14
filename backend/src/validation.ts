import { z } from 'zod';
import { ApiError } from './errors.ts';
export const id = z.string().uuid();
export const timestamp = z.number().int().nonnegative().safe();
export const authInput = z.object({ email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(12).max(128) }).strict();
export const signupInput = authInput.extend({ name: z.string().trim().min(2).max(60) }).strict();
export const holdInput = z.object({ spaceId: id, start: timestamp, end: timestamp, quotedPrice: z.number().int().min(0).max(100000), idempotencyKey: id }).strict();
export const keyInput = z.object({ idempotencyKey: id }).strict();
export const extensionInput = keyInput.extend({ end: timestamp, quotedTotal:z.number().int().min(0).max(2400000).optional() }).strict();
export const inventoryInput = z.object({ capacity: z.number().int().min(0).max(500), price: z.number().int().min(0).max(100000) }).strict();
export const facilityInput = inventoryInput.extend({ operatorId: id, name: z.string().trim().min(2).max(100), area: z.string().trim().min(2).max(160), address: z.string().trim().max(240).default(''), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), type: z.enum(['Covered','Outdoor']) }).strict();
export function parse<Schema extends z.ZodTypeAny>(schema: Schema, body: unknown): z.output<Schema> {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Check the required fields, formats and allowed values.');
  return result.data;
}
