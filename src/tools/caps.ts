export type CapConfig = {
  fallback: number;
  max: number;
};

export function resolveCap(
  name: string,
  value: number | undefined,
  { fallback, max }: CapConfig,
) {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new RangeError(
      `${name} must be an integer from 1 to ${max}, got ${value}`,
    );
  }

  return value;
}
