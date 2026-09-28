import { t } from '@/shared/lib';

/** «1 connection», «2 connections», «5 connections» — the plural form of the interface language. */
export function connectionsCount(n: number): string {
  return t('settings.people.connections', n);
}
