// An account as the screens name it on the balance cards and in the import line: its parts only, never a card number,
// an IBAN or a jar's title. The renderer words them («Black card · UAH», «Jar · UAH #ab12»).

export type AccountName = {
  kind: 'card' | 'jar';
  /** The bank's card type («black», «fop» …); null for a jar or when the bank sends none. */
  type: string | null;
  /** ISO 4217 numeric. */
  currency: number;
  /** The first 4 characters of the account id when another account would read the same; else null. */
  tag: string | null;
};

type AccountRow = { id: string; kind: string; type: string | null; currency: number };

/** Names for a set of accounts, told apart as the core's accountLabels does (a jar by its currency only). */
export function accountNames(accounts: ReadonlyArray<AccountRow>): Map<string, AccountName> {
  const base = accounts.map((a) => {
    const kind = a.kind === 'jar' ? 'jar' : 'card';
    return { id: a.id, name: { kind, type: kind === 'jar' ? null : a.type, currency: a.currency } as const };
  });
  const same = (n: (typeof base)[number]['name']) => `${n.kind}/${n.type ?? ''}/${n.currency}`;
  const counts = new Map<string, number>();
  for (const b of base) counts.set(same(b.name), (counts.get(same(b.name)) ?? 0) + 1);
  return new Map(base.map((b) => [b.id, { ...b.name, tag: (counts.get(same(b.name)) ?? 0) > 1 ? b.id.slice(0, 4) : null }]));
}
