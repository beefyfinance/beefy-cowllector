export type Optional<T, Keys extends keyof T> = Omit<T, Keys> & Partial<Pick<T, Keys>>;
export type OptionalMutable<T, Keys extends keyof T> = Omit<T, Keys> &
  Partial<Pick<{ -readonly [key in Keys]: T[key] }, Keys>>;

export const settledPromiseRejected = (
  result: PromiseSettledResult<unknown>
): result is PromiseRejectedResult => 'rejected' === result.status;
export const settledPromiseFilled = <T>(
  result: PromiseSettledResult<T>
): result is PromiseFulfilledResult<T> => 'fulfilled' === result.status;

export function nodeJsError(testError: unknown): testError is NodeJS.ErrnoException {
  return !!(<NodeJS.ErrnoException>testError).code;
}

export const swapKeyValues = <T extends Record<string, string | number>>(
  obj: T,
  numeric?: boolean
): { [K in keyof T as T['K']]: K } =>
  Object.fromEntries(
    Object.entries(<any>obj).map(([key, value]) => [value, numeric ? parseInt(key) : key])
  );
