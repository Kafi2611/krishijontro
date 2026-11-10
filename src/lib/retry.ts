// A small helper that runs a step again when it fails in a way we expect (for example a booking
// code that someone else took at the same moment). It has no database code, so it is easy to test.

/**
 * Runs `step`. If it throws an error that `shouldRetry` accepts, runs it again, up to `tries`
 * times in total; the last error is thrown on. Any other error is thrown on at once.
 * Example: retryWhen(save, isUniqueConstraintError, 3) -> tries `save` at most 3 times
 */
export async function retryWhen<T>(step: () => Promise<T>, shouldRetry: (error: unknown) => boolean, tries: number): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await step();
    } catch (error) {
      if (attempt >= tries || !shouldRetry(error)) {
        throw error;
      }
    }
  }
}
