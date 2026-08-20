import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate as cvValidate, type ValidationError as CVValidationError } from 'class-validator';

import { ValidationError } from '../dispatcher.js';

export async function validate<T extends object>(
  dtoClass: new (...args: unknown[]) => T,
  body: unknown,
): Promise<T> {
  const instance = plainToInstance(dtoClass, body as object);
  const errors: CVValidationError[] = await cvValidate(instance as object);

  if (errors.length > 0) {
    const formatted = errors.map((err) => ({
      field: err.property,
      constraints: Object.values(err.constraints ?? {}),
    }));
    throw new ValidationError(formatted);
  }

  return instance;
}
