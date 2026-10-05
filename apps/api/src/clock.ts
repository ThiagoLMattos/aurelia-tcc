/** Injectable "now", so services and jobs are testable with a fixed time. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();
