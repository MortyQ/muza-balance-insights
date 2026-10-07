/** The largest reserve «Available per day» accepts: 100 million of its currency, in minor units. */
export const ALLOWANCE_RESERVE_MAX = 10_000_000_000;

/** The currencies a reserve is kept in: the main currencies of the screen (hryvnia, dollar, euro). */
export const ALLOWANCE_RESERVE_CURRENCIES = [980, 840, 978] as const;

/** The reserve «Available per day» keeps aside: in the currency it was typed in, minor units; counted at today's rate. */
export type AllowanceReserve = { currency: (typeof ALLOWANCE_RESERVE_CURRENCIES)[number]; amount: number };

export const NO_RESERVE: AllowanceReserve = { currency: 980, amount: 0 };
