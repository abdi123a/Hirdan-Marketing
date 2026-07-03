import { AppError } from './errors.js';

export function parsePagination(query: any, opts?: { maxTake?: number; defaultTake?: number }) {
  const maxTake = opts?.maxTake ?? 100;
  const defaultTake = opts?.defaultTake ?? 50;

  const rawTake = query?.take;
  const rawSkip = query?.skip;

  const take = rawTake === undefined ? defaultTake : Number(rawTake);
  const skip = rawSkip === undefined ? 0 : Number(rawSkip);

  if (!Number.isFinite(take) || !Number.isInteger(take) || take < 1) {
    throw AppError.badRequest('Invalid take');
  }
  if (!Number.isFinite(skip) || !Number.isInteger(skip) || skip < 0) {
    throw AppError.badRequest('Invalid skip');
  }

  return {
    take: Math.min(take, maxTake),
    skip,
  };
}

