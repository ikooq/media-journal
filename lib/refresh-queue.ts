// Coalesce bursts without cancelling each in-flight read. All callers await the
// same drain, including one trailing refresh when writes arrive during a read.
export function coalesceRefresh(run: () => Promise<void>) {
  let inFlight: Promise<void> | undefined;
  let pending = false;
  return () => {
    pending = true;
    if (!inFlight) {
      inFlight = Promise.resolve().then(async () => {
        try {
          while (pending) {
            pending = false;
            await run();
          }
        } finally {
          inFlight = undefined;
        }
      });
    }
    return inFlight;
  };
}
