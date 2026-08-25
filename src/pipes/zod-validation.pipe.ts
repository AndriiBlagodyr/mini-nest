import { z } from 'zod';

import { ValidationError } from '../filters/exception.filter.js';

export type ZodSchema = z.ZodType<unknown>;

export function zodValidate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'root',
      constraints: [issue.message],
    }));
    throw new ValidationError(errors);
  }
  return result.data;
}
