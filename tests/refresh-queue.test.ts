import { describe, expect, it, vi } from "vitest";
import { coalesceRefresh } from "@/lib/refresh-queue";

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe("coalesced workspace refreshes", () => {
  it("batches same-tick calls into one read and one shared result", async () => {
    const run = vi.fn(async () => {});
    const refresh = coalesceRefresh(run);
    const first = refresh();
    expect(refresh()).toBe(first);
    expect(refresh()).toBe(first);
    await first;
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("does not overlap reads and awaits a trailing refresh for new writes", async () => {
    const firstRead = gate(),
      secondRead = gate();
    const run = vi
      .fn()
      .mockImplementationOnce(() => firstRead.promise)
      .mockImplementationOnce(() => secondRead.promise);
    const refresh = coalesceRefresh(run);
    const first = refresh();
    await Promise.resolve();
    const later = refresh();
    refresh();
    refresh();
    expect(later).toBe(first);
    expect(run).toHaveBeenCalledTimes(1);
    firstRead.resolve();
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);
    let finished = false;
    void later.then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    secondRead.resolve();
    await first;
    expect(finished).toBe(true);
  });
  it("can refresh again after draining", async () => {
    const run = vi.fn(async () => {});
    const refresh = coalesceRefresh(run);
    await refresh();
    await refresh();
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("recovers after a read fails", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(undefined);
    const refresh = coalesceRefresh(run);
    await expect(refresh()).rejects.toThrow("network");
    await refresh();
    expect(run).toHaveBeenCalledTimes(2);
  });
});
