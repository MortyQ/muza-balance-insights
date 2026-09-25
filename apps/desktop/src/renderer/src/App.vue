<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { BalanceApi, DataStatus, TokenStatus } from '../../shared/api.ts';
import { IMPORT_DEPTHS, type ImportDepth, type ImportProgress } from '../../shared/progress.ts';
import BalancesCard from './components/BalancesCard.vue';
import SpendingCard from './components/SpendingCard.vue';
import { shortDate } from './lib/months.ts';
import { VButton, VCard, VInfoNotice, VProgressBar } from './ui/index.ts';

const api = (window as unknown as { balance: BalanceApi }).balance;
const disclaimer = 'Неофициальное приложение, не связано с Monobank.';
// A failed call to main (refused, main restarted, an old main without the handler) — shown, never an unhandled rejection.
const FAILED_TEXT = 'Не удалось выполнить действие. Перезапусти приложение; если повторится — пришли строки [ipc] из терминала.';

// ---------- token ----------
const tokenInput = ref('');
const remember = ref(true);
const status = ref<TokenStatus | null>(null);
const tokenError = ref('');
const busy = ref(false);

async function refreshStatus() {
  status.value = await api.hasToken();
}

async function saveToken() {
  tokenError.value = '';
  busy.value = true;
  try {
    await api.setToken(tokenInput.value.trim(), remember.value);
    await refreshStatus();
  } catch {
    tokenError.value = 'Токен не сохранён: проверь, что вставлен весь токен без пробелов.';
  } finally {
    // The token never stays in the renderer: the field is cleared whatever happened.
    tokenInput.value = '';
    busy.value = false;
  }
}

async function forgetToken() {
  tokenError.value = '';
  try {
    await api.clearToken();
    await refreshStatus();
  } catch {
    tokenError.value = FAILED_TEXT;
  }
}

const tokenLine = computed(() => {
  const s = status.value;
  if (!s) return '…';
  if (!s.present) return s.needsReentry ? 'Сохранённый токен больше не читается — введи его заново.' : 'Токен не задан.';
  return s.stored === 'secure' ? 'Токен сохранён в системном хранилище ключей.' : 'Токен только в памяти: после закрытия приложения его нужно ввести снова.';
});

// ---------- import ----------
const depth = ref<ImportDepth>(3);
const progress = ref<ImportProgress>({ phase: 'idle' });
const importError = ref('');
const running = computed(() => ['starting', 'accounts', 'windows', 'retry', 'rederive'].includes(progress.value.phase));

async function startImport() {
  importError.value = '';
  try {
    const r = await api.startImport(depth.value);
    if (!r.started) importError.value = r.reason === 'no-token' ? 'Сначала введи токен.' : 'Импорт уже идёт.';
  } catch {
    importError.value = FAILED_TEXT;
  }
}

async function cancelImport() {
  try {
    await api.cancelImport();
  } catch {
    importError.value = FAILED_TEXT;
  }
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec} с`;
  const m = Math.round(sec / 60);
  return m < 60 ? `≈ ${m} мин` : `≈ ${Math.floor(m / 60)} ч ${m % 60} мин`;
}

const progressLine = computed(() => {
  const p = progress.value;
  switch (p.phase) {
    case 'idle':
      return '';
    case 'needs-token':
      return 'Есть незавершённый импорт. Введи токен, чтобы продолжить.';
    case 'starting':
      return p.resumed ? 'Продолжаю импорт…' : 'Запускаю импорт…';
    case 'accounts':
      return 'Обновляю список счетов…';
    case 'windows': {
      const wait = p.waitingSec ? ` · жду лимит Monobank ${p.waitingSec} с` : '';
      return `${p.account}: окно ${p.from} … ${p.to} (${p.index}/${p.total}) · загружено окон ${p.windowsDone} из ${p.windowsTotal}, операций ${p.transactions} · осталось ${fmtDuration(p.etaSec)}${wait}`;
    }
    case 'retry': {
      const why = { network: 'Нет связи с Monobank', server: 'Monobank временно не отвечает', 'rate-limit': 'Monobank просит подождать', crash: 'Процесс импорта перезапускается' }[p.reason];
      const at = new Date(Date.now() + p.inSec * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `${why}. Повтор в ${at} (попытка ${p.attempt}). Уже загруженное сохранено.`;
    }
    case 'rederive':
      return 'Размечаю переводы и категории…';
    case 'done':
      return `Готово: окон ${p.windowsTotal}, операций ${p.transactions}.`;
    case 'cancelled':
      return 'Импорт остановлен. Уже загруженное сохранено.';
    case 'error':
      return p.message;
  }
  return '';
});

const windowsPercent = computed(() => {
  const p = progress.value;
  return p.phase === 'windows' && p.windowsTotal > 0 ? (p.windowsDone / p.windowsTotal) * 100 : null;
});

// ---------- data ----------
const dataStatus = ref<DataStatus | null>(null);
const dataError = ref(false);
/** Bumped whenever the numbers may have changed: the cards reload on it. */
const refreshKey = ref(0);

async function refreshData() {
  try {
    dataStatus.value = await api.getSyncStatus();
    dataError.value = false;
  } catch {
    // Never read a failure as «no data»: say so, keep what was shown.
    dataError.value = true;
  }
  refreshKey.value += 1;
}

const statusLine = computed(() => {
  const s = dataStatus.value;
  if (!s) return '';
  return s.hasData && s.dataUntil ? `Данные до ${shortDate(s.dataUntil)}` : 'Данных пока нет';
});

// ---------- delete all data ----------
const deleting = ref(false);
const deleteError = ref('');

async function deleteAll() {
  deleteError.value = '';
  deleting.value = true;
  try {
    const { deleted } = await api.deleteAllData();
    if (!deleted) return;
    tokenInput.value = '';
    await refreshStatus();
    await refreshData();
  } catch {
    deleteError.value = 'Не всё удалось удалить. Перезапусти приложение и попробуй ещё раз.';
  } finally {
    deleting.value = false;
  }
}

let off: (() => void) | null = null;
onMounted(async () => {
  off = api.onProgress((p) => {
    const was = progress.value.phase;
    progress.value = p;
    if (p.phase === 'needs-token') void refreshStatus();
    // An import ended (or a window landed after a long wait): the numbers changed.
    if (['done', 'cancelled', 'error'].includes(p.phase) && was !== p.phase) void refreshData();
  });
  await refreshStatus();
  await refreshData();
});
onUnmounted(() => off?.());
</script>

<template>
  <main class="mx-auto flex max-w-4xl flex-col gap-4 px-8 py-6">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h1 class="text-xl font-semibold">Balance Insights</h1>
      <span v-if="statusLine" class="text-sm text-foreground-muted tabular-nums">{{ statusLine }}</span>
    </header>

    <VInfoNotice
      v-if="dataError"
      :card="false"
      icon="lucide:circle-alert"
      tone="danger"
      subtitle="Не удалось прочитать данные. Перезапусти приложение; если повторится — пришли строки [ipc] из терминала."
    />

    <template v-if="dataStatus?.hasData">
      <SpendingCard :api="api" :refresh-key="refreshKey" />
      <BalancesCard :api="api" :refresh-key="refreshKey" />
    </template>

    <VCard title="Импорт" padding="md">
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <label class="flex items-center gap-2">
            Глубина:
            <select
              v-model.number="depth"
              class="h-(--control-h) rounded-md border border-input-border bg-input-bg px-2 disabled:text-foreground-disabled"
              :disabled="running"
            >
              <option v-for="d in IMPORT_DEPTHS" :key="d" :value="d">{{ d }} мес.</option>
            </select>
          </label>
          <VButton v-if="!running" text="Загрузить" icon="lucide:download" :disabled="!status?.present || deleting" @click="startImport" />
          <VButton v-else variant="neutral" text="Остановить" icon="lucide:square" @click="cancelImport" />
        </div>
        <VProgressBar v-if="windowsPercent !== null" :percentage="windowsPercent" size="sm" />
        <p v-if="progressLine" class="text-foreground-secondary tabular-nums">{{ progressLine }}</p>
        <VInfoNotice v-if="importError" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="importError" />
        <p class="text-sm text-foreground-muted">
          Monobank отдаёт выписку не чаще раза в минуту и не больше 31 дня за запрос: примерно минута на каждый месяц истории каждого
          счёта. Сначала загружается текущий месяц по всем счетам, потом история. Импорт можно остановить и продолжить позже.
        </p>
      </div>
    </VCard>

    <VCard title="Токен Monobank" padding="md">
      <div class="flex flex-col gap-3">
        <p class="text-foreground-secondary">{{ tokenLine }}</p>
        <VInfoNotice
          v-if="status && !status.secureStorage"
          :card="false"
          icon="lucide:triangle-alert"
          tone="warning"
          subtitle="На этом компьютере нет защищённого хранилища ключей: токен не будет сохранён, только в памяти до закрытия приложения."
        />
        <form class="flex flex-wrap items-center gap-3" @submit.prevent="saveToken">
          <input
            v-model="tokenInput"
            class="h-(--control-h) w-[420px] max-w-full rounded-md border border-input-border bg-input-bg px-(--control-px) placeholder:text-input-placeholder focus:border-border-focus focus:outline-none"
            type="password"
            autocomplete="off"
            spellcheck="false"
            placeholder="Вставь токен с api.monobank.ua"
          />
          <label class="flex items-center gap-2"><input v-model="remember" class="accent-primary" type="checkbox" /> Запомнить на этом компьютере</label>
          <VButton type="submit" text="Сохранить" :loading="busy" :disabled="tokenInput.trim() === ''" />
          <VButton v-if="status?.present" variant="neutral" text="Забыть токен" @click="forgetToken" />
        </form>
        <VInfoNotice v-if="tokenError" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="tokenError" />
      </div>
    </VCard>

    <VCard title="Данные на этом компьютере" padding="md">
      <div class="flex flex-col gap-3">
        <p class="text-sm text-foreground-muted">
          Операции хранятся только здесь, в базе приложения. «Удалить все данные» стирает базу, сохранённый токен и незавершённый
          импорт; перед удалением приложение спросит подтверждение.
        </p>
        <div>
          <VButton variant="negative" text="Удалить все данные" icon="lucide:trash" :loading="deleting" @click="deleteAll" />
        </div>
        <VInfoNotice v-if="deleteError" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="deleteError" />
      </div>
    </VCard>

    <p class="text-sm text-foreground-muted">{{ disclaimer }}</p>
  </main>
</template>
