import type { Registry } from './registry';

/**
 * Strings registry (§7.11). Every built-in UI string resolves through this
 * bundle so hosts can localise the board without forking components. English
 * and Kiswahili ship as examples; any locale can be added with `defineStrings`.
 */

export const DEFAULT_STRINGS: Record<string, string> = {
  'board.skip': 'Skip',
  'board.return': 'Back',
  'board.continue': 'Continue',
  'board.hint': 'Hint',
  'board.check': 'Check',
  'board.submit': 'Submit',
  'board.review': 'Review',
  'board.close': 'Close',
  'board.reset': 'Reset',
  'board.resetView': 'Reset view',
  'board.loading': 'Loading…',
  'board.empty': 'Nothing on the board yet.',
  'board.error': 'This part could not be shown.',
  'board.retry': 'Try again',
  'board.thinking': 'Thinking…',
  'board.listening': 'Listening…',
  'board.speaking': 'Speaking…',
  'board.archive': 'Earlier content',
  'assessment.timer': 'Time left',
  'assessment.flagged': 'Flagged',
  'assessment.answered': 'Answered',
  'assessment.unanswered': 'Not answered',
  'assessment.unvisited': 'Not visited',
  'assessment.next': 'Next',
  'assessment.previous': 'Previous',
  'assessment.question': 'Question',
  'assessment.of': 'of',
  'assessment.start': 'Start',
  'assessment.warning': 'Time is running out',
  'assessment.timeUp': "Time's up",
  'assessment.navigator': 'Questions',
  'assessment.submitConfirm': 'Submit your answers?',
  'assessment.paused': 'Paused',
  'assessment.resume': 'Resume',
  'flashcards.flip': 'Flip card',
  'flashcards.knew': 'I knew it',
  'flashcards.unsure': 'Not sure',
  'flashcards.missed': 'I missed it',
  'model.parts': 'Parts',
  'model.views': 'Views',
  'model.reset': 'Reset view',
  'model.webglUnavailable': '3D is not available on this device.',
  'model.loading': 'Loading model…',
};

/** Example Kiswahili bundle (generic UI strings only, no product copy). */
export const SWAHILI_STRINGS: Record<string, string> = {
  'board.skip': 'Ruka',
  'board.return': 'Rudi',
  'board.continue': 'Endelea',
  'board.hint': 'Kidokezo',
  'board.check': 'Angalia',
  'board.submit': 'Wasilisha',
  'board.review': 'Pitia',
  'board.close': 'Funga',
  'board.reset': 'Anza upya',
  'board.resetView': 'Rejesha mwonekano',
  'board.loading': 'Inapakia…',
  'board.empty': 'Bado hakuna kitu ubaoni.',
  'board.error': 'Sehemu hii haikuweza kuonyeshwa.',
  'board.retry': 'Jaribu tena',
  'board.thinking': 'Inafikiri…',
  'board.listening': 'Inasikiliza…',
  'board.speaking': 'Inazungumza…',
  'board.archive': 'Maudhui ya awali',
  'assessment.timer': 'Muda uliobaki',
  'assessment.flagged': 'Imewekwa alama',
  'assessment.answered': 'Imejibiwa',
  'assessment.unanswered': 'Haijajibiwa',
  'assessment.unvisited': 'Haijatembelewa',
  'assessment.next': 'Ifuatayo',
  'assessment.previous': 'Iliyopita',
  'assessment.question': 'Swali',
  'assessment.of': 'kati ya',
  'assessment.start': 'Anza',
  'assessment.warning': 'Muda unakaribia kuisha',
  'assessment.timeUp': 'Muda umeisha',
  'assessment.navigator': 'Maswali',
  'assessment.submitConfirm': 'Wasilisha majibu yako?',
  'assessment.paused': 'Imesimamishwa',
  'assessment.resume': 'Endelea',
  'flashcards.flip': 'Pindua kadi',
  'flashcards.knew': 'Nilijua',
  'flashcards.unsure': 'Sina uhakika',
  'flashcards.missed': 'Nilikosea',
  'model.parts': 'Sehemu',
  'model.views': 'Mitazamo',
  'model.reset': 'Rejesha mwonekano',
  'model.webglUnavailable': '3D haipatikani kwenye kifaa hiki.',
  'model.loading': 'Inapakia modeli…',
};

export type StringValues = Record<string, string | number>;

/** Replace `{name}` placeholders; unknown placeholders are left untouched. */
export function formatString(template: string, values?: StringValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/** Per-locale bundle contributed through `defineStrings` / a plugin. */
export interface RegisteredStrings {
  locale: string;
  strings: Record<string, string>;
}

/**
 * Merge the built-in English defaults with every registered locale bundle in
 * the fallback chain. The requested locale wins; English fills any gaps.
 */
export function resolveStrings(
  registry: Registry,
  locale = 'en',
  fallbacks: string[] = ['en'],
): Record<string, string> {
  const chain = [locale, ...fallbacks.filter(code => code !== locale), 'en'];
  const merged: Record<string, string> = { ...DEFAULT_STRINGS };
  for (const code of chain.reverse()) {
    const bundle = registry.get('strings', code) as RegisteredStrings | undefined;
    if (bundle?.strings) Object.assign(merged, bundle.strings);
  }
  return merged;
}

export interface Translator {
  (key: string, values?: StringValues): string;
  strings: Record<string, string>;
  locale: string;
}

/** Create a translator for one locale, with `{placeholder}` interpolation. */
export function createTranslator(
  registry: Registry,
  locale = 'en',
  fallbacks: string[] = ['en'],
): Translator {
  const strings = resolveStrings(registry, locale, fallbacks);
  const translator = ((key: string, values?: StringValues) =>
    formatString(strings[key] ?? key, values)) as Translator;
  translator.strings = strings;
  translator.locale = locale;
  return translator;
}
