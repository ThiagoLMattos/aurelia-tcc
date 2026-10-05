import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/client';
import { createSosSender } from '@/elder/sos';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createSosSender', () => {
  it('sends once and reports sent', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const sender = createSosSender({ send });
    sender.start({ lat: 1, lng: 2 });
    expect(sender.getStatus()).toBe('sending');
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledWith({ lat: 1, lng: 2 });
    expect(sender.getStatus()).toBe('sent');
  });

  it('keeps retrying while the network is down, then succeeds', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('NETWORK', 'offline'))
      .mockRejectedValueOnce(new ApiError('TIMEOUT', 'slow'))
      .mockResolvedValue(undefined);
    const sender = createSosSender({ send, delaysMs: [1000, 2000] });
    sender.start({});
    await vi.advanceTimersByTimeAsync(0);
    expect(sender.getStatus()).toBe('retrying');
    await vi.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(send).toHaveBeenCalledTimes(3);
    expect(sender.getStatus()).toBe('sent');
  });

  it('gives up on answers a retry cannot fix, and after the attempt limit', async () => {
    const rejected = vi.fn().mockRejectedValue(new ApiError('FORBIDDEN', 'no', 403));
    const a = createSosSender({ send: rejected });
    a.start({});
    await vi.advanceTimersByTimeAsync(0);
    expect(a.getStatus()).toBe('failed');
    expect(rejected).toHaveBeenCalledTimes(1);

    const down = vi.fn().mockRejectedValue(new ApiError('NETWORK', 'offline'));
    const b = createSosSender({ send: down, delaysMs: [10], maxAttempts: 3 });
    b.start({});
    await vi.advanceTimersByTimeAsync(100);
    expect(down).toHaveBeenCalledTimes(3);
    expect(b.getStatus()).toBe('failed');
  });

  it('a new SOS replaces one that is still retrying', async () => {
    const send = vi.fn().mockRejectedValueOnce(new ApiError('NETWORK', 'offline')).mockResolvedValue(undefined);
    const sender = createSosSender({ send, delaysMs: [1000] });
    sender.start({ lat: 1, lng: 1 });
    await vi.advanceTimersByTimeAsync(0);
    sender.start({ lat: 2, lng: 2 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ lat: 2, lng: 2 });
  });
});
