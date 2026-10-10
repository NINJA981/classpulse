/**
 * Request parsing helpers. Every handler parses its inputs through a zod schema
 * (body, params and query) — unknown keys are stripped, which blocks mass
 * assignment and query-operator injection. ZodErrors become 400 VALIDATION_FAILED.
 */
import type { Request } from 'express';
import type { z } from 'zod';

export const parseBody = <S extends z.ZodType>(req: Request, schema: S): z.output<S> => schema.parse(req.body ?? {});
export const parseParams = <S extends z.ZodType>(req: Request, schema: S): z.output<S> => schema.parse(req.params);
export const parseQuery = <S extends z.ZodType>(req: Request, schema: S): z.output<S> => schema.parse(req.query);
