// Renderer tests read texts in Russian: ru.json holds the texts the screens had before the dictionaries, so their
// assertions did not have to change. The app itself starts in the system's language, else Ukrainian.
import { i18n } from '@/shared/lib/i18n.ts';

i18n.global.locale.value = 'ru';
