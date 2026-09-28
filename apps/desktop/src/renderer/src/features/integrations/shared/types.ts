import type { Component, ComputedRef, Ref } from 'vue';
import type { ColorKey, ConnectionAccountView, ParticipantChoice } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

/** A bank's add form: holds the <form>; the owner fields come in its default slot; emits `added` once saved. */
export interface ConnectFormProps {
  /** Who the connection is for; null while a new person has no name. */
  owner: ParticipantChoice | null;
  submitText: string;
  autofocus: boolean;
}

/** A bank's token field, next to v-model:token and v-model:remember: the add form and «Enter token again». */
export interface TokenFieldProps {
  secureStorage: boolean;
  autofocus?: boolean;
}

/** One bank's forms and texts, picked by the domain root. */
export interface ProviderForms {
  connect: Component<ConnectFormProps>;
  tokenField: Component<TokenFieldProps>;
  /** Under the bank's name on the first connect screen: what the access gives and where it is kept (a dictionary key). */
  accessNote: MessageKey;
  /** The bank's card types → dictionary keys of their names in «Accounts» (an unknown type shows as it is). */
  cardTypes: Readonly<Record<string, MessageKey>>;
}

export type SubmitState = { status: 'idle' } | { status: 'saving' } | { status: 'error'; message: string };

/** An existing participant's id, or a new person. */
export type PersonChoice = number | 'new';

/** Whose a new connection is and a new person's colour — the part of the add form that is the same for every bank. */
export interface UseConnectionOwnerReturn {
  person: Ref<PersonChoice>;
  newLabel: Ref<string>;
  /** The new person's name comes from the bank on the first import. */
  fromBank: Ref<boolean>;
  /** The chosen colour; until one is picked — the first free one. */
  personColor: Ref<ColorKey | null>;
  /** Colour → who has it, among people. */
  takenPersonColors: ComputedRef<Map<ColorKey, string>>;
  /** Who the connection is for, with the new person's colour; null while a new person has no name. */
  owner: ComputedRef<ParticipantChoice | null>;
  /** Back to a new person with no name and the first free colours, after a connection is added. */
  reset: () => void;
}

/** A connection's accounts in «Accounts»: the list stays while it reloads. */
export type AccountsState =
  | { status: 'loading' }
  | { status: 'ready'; accounts: ReadonlyArray<ConnectionAccountView> }
  | { status: 'error' };

export interface UseConnectionActionsReturn {
  error: Readonly<Ref<string>>;
  /** true = saved; the caller clears its field either way. */
  setToken: (connectionId: number, token: string, remember: boolean) => Promise<boolean>;
  remove: (connectionId: number) => Promise<void>;
  /** Connection id → its accounts, once «Accounts» was opened. */
  accounts: Readonly<Ref<ReadonlyMap<number, AccountsState>>>;
  /** Loads (or reloads) a connection's accounts. */
  loadAccounts: (connectionId: number) => Promise<void>;
  /** The account whose toggle is being saved; null = none. */
  savingAccount: Readonly<Ref<string | null>>;
  /** true = changed; false = refused (import running) or failed, the message is in `error`. */
  setAccountEnabled: (connectionId: number, accountId: string, enabled: boolean) => Promise<boolean>;
}
