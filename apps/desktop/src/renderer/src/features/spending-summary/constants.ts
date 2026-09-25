import type { Scope } from '@contract/api.ts';
import type { SegmentOption } from '@/shared/ui';

export const SCOPES: SegmentOption<Scope>[] = [
  { label: 'Личное', value: 'personal' },
  { label: 'Бизнес', value: 'business' },
];
