/**
 * Reading texts aggregator - imports all language modules
 * and provides the same API as the old readingTexts.js file
 */

// Import language modules (modular structure)
import { englishReadingTexts } from './languages/english.js';
import { hebrewReadingTexts } from './languages/hebrew.js';

// Import Cafe Talk modules
import { hebrewCafeTalkTexts } from './cafeTalk/hebrew.js';
import { arabicCafeTalkTexts } from './cafeTalk/arabic.js';
import { mandarinCafeTalkTexts } from './cafeTalk/mandarin.js';
import { hindiCafeTalkTexts } from './cafeTalk/hindi.js';
import { englishCafeTalkTexts } from './cafeTalk/english.js';
import { spanishCafeTalkTexts } from './cafeTalk/spanish.js';
import { frenchCafeTalkTexts } from './cafeTalk/french.js';
import { portugueseCafeTalkTexts } from './cafeTalk/portuguese.js';
import { russianCafeTalkTexts } from './cafeTalk/russian.js';
import { japaneseCafeTalkTexts } from './cafeTalk/japanese.js';
import { bengaliCafeTalkTexts } from './cafeTalk/bengali.js';
import { amharicCafeTalkTexts } from './cafeTalk/amharic.js';

// Import Module Vocabulary and Grammar texts
import { moduleVocabTexts } from './modules/moduleVocab.js';
import { moduleGrammarTexts } from './modules/moduleGrammar.js';

// Import sentences for conversion
import { allSentences } from '../sentences/index.ts';

// Temporarily import from old file for languages not yet migrated
import {
  arabicReadingTexts,
  mandarinReadingTexts,
  hindiReadingTexts,
  spanishReadingTexts,
  frenchReadingTexts,
  portugueseReadingTexts,
  russianReadingTexts,
  japaneseReadingTexts,
  bengaliReadingTexts,
  amharicReadingTexts
} from '../readingTexts.js';

/**
 * Add sectionId to texts if not already present
 * @param {Array} texts - Reading texts
 * @param {string} defaultSectionId - Default section identifier if text doesn't have one
 * @returns {Array} Texts with sectionId added
 */
function addSectionId(texts, defaultSectionId) {
  return texts.map(text => ({
    ...text,
    sectionId: text.sectionId || defaultSectionId
  }));
}

function normalizeLanguageId(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/**
 * Word dictionary for sentence words
 * Maps wordId to { meaning, transliteration, variants }
 */
const wordDictionary = {
  // Names
  'Dani': { meaning: 'Dani', transliteration: 'Dani', variants: ['Dani'] },

  // Greetings & basic words
  'shalom': { meaning: 'hello, peace', transliteration: 'shalom', variants: ['shalom', 'hello'] },
  'todah': { meaning: 'thank you', transliteration: 'todah', variants: ['todah', 'toda'] },

  // Pronouns
  'I': { meaning: 'I', transliteration: 'ani', variants: ['ani'] },
  'you': { meaning: 'you', transliteration: 'atah', variants: ['atah', 'ata', 'at'] },
  'you-m': { meaning: 'you (m)', transliteration: 'atah', variants: ['atah', 'ata'] },
  'you-f': { meaning: 'you (f)', transliteration: 'at', variants: ['at'] },
  'he': { meaning: 'he', transliteration: 'hu', variants: ['hu'] },
  'she': { meaning: 'she', transliteration: 'hi', variants: ['hi'] },
  'we': { meaning: 'we', transliteration: 'anachnu', variants: ['anachnu', 'anakhnu'] },
  'they': { meaning: 'they', transliteration: 'hem', variants: ['hem'] },

  // Common verbs & adjectives
  'happy': { meaning: 'happy', transliteration: 'sameach', variants: ['sameach', 'same\'ach'] },
  'new': { meaning: 'new', transliteration: 'chadash', variants: ['chadash', 'hadash'] },
  'new-f': { meaning: 'new (f)', transliteration: 'chadasha', variants: ['chadasha', 'hadasha'] },
  'good': { meaning: 'good', transliteration: 'tov', variants: ['tov'] },
  'great': { meaning: 'great', transliteration: 'nehedar', variants: ['nehedar'] },
  'nice': { meaning: 'nice', transliteration: 'nechmed', variants: ['nechmed', 'nekhmed'] },
  'beautiful': { meaning: 'beautiful', transliteration: 'yafe', variants: ['yafe', 'yafeh'] },

  // Nouns
  'friend': { meaning: 'friend', transliteration: 'chaver', variants: ['chaver', 'haver'] },
  'family': { meaning: 'family', transliteration: 'mishpacha', variants: ['mishpacha'] },
  'neighbor': { meaning: 'neighbor', transliteration: 'shachen', variants: ['shachen', 'shaken'] },
  'child': { meaning: 'child', transliteration: 'yeled', variants: ['yeled'] },
  'language': { meaning: 'language', transliteration: 'safa', variants: ['safa', 'safah'] },
  'word': { meaning: 'word', transliteration: 'mila', variants: ['mila', 'milah'] },
  'home': { meaning: 'home', transliteration: 'bayit', variants: ['bayit', 'bait'] },
  'idea': { meaning: 'idea', transliteration: 'rayon', variants: ['rayon', 'ra\'ayon'] },
  'question': { meaning: 'question', transliteration: 'she\'ela', variants: ['she\'ela', 'sheela'] },
  'answer': { meaning: 'answer', transliteration: 'tshuva', variants: ['tshuva', 'teshuva'] },
  'book': { meaning: 'book', transliteration: 'sefer', variants: ['sefer'] },
  'food': { meaning: 'food', transliteration: 'ochel', variants: ['ochel'] },
  'water': { meaning: 'water', transliteration: 'mayim', variants: ['mayim'] },
  'coffee': { meaning: 'coffee', transliteration: 'cafe', variants: ['cafe', 'kafe'] },
  'city': { meaning: 'city', transliteration: 'ir', variants: ['ir'] },

  // Time words
  'today': { meaning: 'today', transliteration: 'hayom', variants: ['hayom', 'ha-yom'] },
  'tomorrow': { meaning: 'tomorrow', transliteration: 'machar', variants: ['machar'] },
  'yesterday': { meaning: 'yesterday', transliteration: 'etmol', variants: ['etmol'] },
  'now': { meaning: 'now', transliteration: 'achshav', variants: ['achshav', 'akhshav'] },
  'time': { meaning: 'time', transliteration: 'zman', variants: ['zman'] },
  'day': { meaning: 'day', transliteration: 'yom', variants: ['yom'] },
  'boker': { meaning: 'morning', transliteration: 'boker', variants: ['boker'] },
  'erev': { meaning: 'evening', transliteration: 'erev', variants: ['erev'] },
  'early': { meaning: 'early', transliteration: 'mukdam', variants: ['mukdam'] },
  'late': { meaning: 'late', transliteration: 'meuchar', variants: ['meuchar', 'me\'uchar'] },
  'always': { meaning: 'always', transliteration: 'tamid', variants: ['tamid'] },
  'sometimes': { meaning: 'sometimes', transliteration: 'lifamim', variants: ['lifamim', 'lif\'amim'] },

  // Verbs
  'meet': { meaning: 'meet', transliteration: 'lehakir', variants: ['meet', 'to meet'] },
  'want': { meaning: 'want', transliteration: 'rotze', variants: ['want'] },
  'need': { meaning: 'need', transliteration: 'tzarich', variants: ['need'] },
  'come': { meaning: 'come', transliteration: 'ba', variants: ['come', 'came'] },
  'arrive': { meaning: 'arrive', transliteration: 'magi\'a', variants: ['arrive'] },
  'wait': { meaning: 'wait', transliteration: 'mechake', variants: ['wait', 'waiting'] },
  'ask': { meaning: 'ask', transliteration: 'lish\'ol', variants: ['ask'] },
  'say': { meaning: 'say', transliteration: 'lomar', variants: ['say'] },
  'study': { meaning: 'study', transliteration: 'lilmod', variants: ['study', 'learn'] },
  'read': { meaning: 'read', transliteration: 'likro', variants: ['read'] },
  'eat': { meaning: 'eat', transliteration: 'le\'echol', variants: ['eat'] },
  'drink': { meaning: 'drink', transliteration: 'lishtot', variants: ['drink'] },
  'buy': { meaning: 'buy', transliteration: 'liknot', variants: ['buy'] },
  'pay': { meaning: 'pay', transliteration: 'leshalem', variants: ['pay'] },
  'help': { meaning: 'help', transliteration: 'la\'azor', variants: ['help'] },
  'start': { meaning: 'start', transliteration: 'lehatchil', variants: ['start'] },
  'finish': { meaning: 'finish', transliteration: 'lesayem', variants: ['finish'] },
  'go': { meaning: 'go', transliteration: 'lalechet', variants: ['go'] },
  'love': { meaning: 'love', transliteration: 'ohev', variants: ['love', 'like'] },
  'sit': { meaning: 'sit', transliteration: 'lashevet', variants: ['sit'] },
  'speak': { meaning: 'speak', transliteration: 'ledaber', variants: ['speak', 'talk'] },
  'live': { meaning: 'live', transliteration: 'gar', variants: ['live'] },
  'cook': { meaning: 'cook', transliteration: 'mevashel', variants: ['cook'] },
  'order': { meaning: 'order', transliteration: 'mezamin', variants: ['order'] },
  'rest': { meaning: 'rest', transliteration: 'lanuach', variants: ['rest'] },

  // Compound words and phrases
  'where-from': { meaning: 'where from', transliteration: 'me-eifo', variants: ['where from', 'from where'] },
  'you-came': { meaning: 'you came', transliteration: 'she-bata', variants: ['you came', 'came'] },
  'to-you': { meaning: 'to you', transliteration: 'lecha', variants: ['to you', 'you', 'for you'] },
  'that-you': { meaning: 'that you', transliteration: 'she-ata', variants: ['that you', 'you'] },
  'with-us': { meaning: 'with us', transliteration: 'itanu', variants: ['with us'] },
  'together': { meaning: 'together', transliteration: 'yachad', variants: ['together'] },
  'how': { meaning: 'how', transliteration: 'eich', variants: ['how'] },
  'yours': { meaning: 'yours', transliteration: 'shelcha', variants: ['yours', 'your'] },
  'short': { meaning: 'short', transliteration: 'ktzara', variants: ['short'] },
  'about': { meaning: 'about', transliteration: 'al', variants: ['about', 'on'] },
  'this': { meaning: 'this', transliteration: 'ze', variants: ['this'] },
  'my-name': { meaning: 'my name', transliteration: 'shmi', variants: ['my name'] },
  'friends': { meaning: 'friends', transliteration: 'chaverim', variants: ['friends'] },
  'ours': { meaning: 'ours', transliteration: 'shelanu', variants: ['ours', 'our'] },
  'full': { meaning: 'full', transliteration: 'male', variants: ['full'] },
  'in-family': { meaning: 'in family', transliteration: 'be-mishpacha', variants: ['in family'] },
  'and-friends': { meaning: 'and friends', transliteration: 've-chaverim', variants: ['and friends'] },
  'like': { meaning: 'like', transliteration: 'ohavim', variants: ['like', 'love'] },
  'quiet': { meaning: 'quiet', transliteration: 'shaket', variants: ['quiet'] },
  'to-us': { meaning: 'to us', transliteration: 'lanu', variants: ['to us'] },
  'small': { meaning: 'small', transliteration: 'katan', variants: ['small'] },
  'in-room': { meaning: 'in room', transliteration: 'be-cheder', variants: ['in room'] },
  'his': { meaning: 'his', transliteration: 'shelo', variants: ['his'] },
  'in-kitchen': { meaning: 'in kitchen', transliteration: 'be-mitbach', variants: ['in kitchen', 'in the kitchen'] },
  'near': { meaning: 'near', transliteration: 'leyad', variants: ['near', 'next to'] },
  'warm': { meaning: 'warm', transliteration: 'cham', variants: ['warm', 'hot'] },
  'cold-pl': { meaning: 'cold', transliteration: 'karim', variants: ['cold'] },
  'love-f': { meaning: 'love', transliteration: 'ohevet', variants: ['love', 'like'] },
  'restaurant': { meaning: 'restaurant', transliteration: 'be-mis\'ada', variants: ['restaurant', 'in restaurant'] },
  'tasty': { meaning: 'tasty', transliteration: 'ta\'im', variants: ['tasty', 'delicious'] },
  'very': { meaning: 'very', transliteration: 'me\'od', variants: ['very'] },
  'bread': { meaning: 'bread', transliteration: 'lechem', variants: ['bread'] },
  'fresh': { meaning: 'fresh', transliteration: 'tari', variants: ['fresh'] },
  'the-family': { meaning: 'the family', transliteration: 'ha-mishpacha', variants: ['the family', 'family'] },
  'more': { meaning: 'more', transliteration: 'od', variants: ['more'] },
  'please': { meaning: 'please', transliteration: 'bevakasha', variants: ['please'] },
  'another': { meaning: 'another', transliteration: 'nosaf', variants: ['another'] },
  'meal-of': { meaning: 'meal', transliteration: 'aruchat', variants: ['meal'] },
  'a-lot': { meaning: 'a lot', transliteration: 'harbe', variants: ['a lot', 'many', 'much'] },
  'at-station': { meaning: 'at station', transliteration: 'be-tachana', variants: ['at station', 'at the station'] },
  'in-order-to': { meaning: 'in order to', transliteration: 'kedei', variants: ['in order to', 'to'] },
  'meeting': { meaning: 'meeting', transliteration: 'pgisha', variants: ['meeting'] },
  'exactly': { meaning: 'exactly', transliteration: 'be-diyuk', variants: ['exactly'] },
  'after': { meaning: 'after', transliteration: 'acharei', variants: ['after'] },
  'ten': { meaning: 'ten', transliteration: 'eser', variants: ['ten', '10'] },
  'minutes': { meaning: 'minutes', transliteration: 'dakot', variants: ['minutes'] },
  'too': { meaning: 'too', transliteration: 'midai', variants: ['too'] },
  'hour': { meaning: 'hour', transliteration: 'sha\'a', variants: ['hour'] },

  // Other common words
  'yes': { meaning: 'yes', transliteration: 'ken', variants: ['ken'] },
  'no': { meaning: 'no', transliteration: 'lo', variants: ['lo'] },
  'here': { meaning: 'here', transliteration: 'kan', variants: ['kan'] },
  'there': { meaning: 'there', transliteration: 'sham', variants: ['sham'] },
  'with': { meaning: 'with', transliteration: 'im', variants: ['im'] },
  'in': { meaning: 'in', transliteration: 'be', variants: ['be', 'b'] },
  'to': { meaning: 'to', transliteration: 'le', variants: ['le', 'l'] },
  'from': { meaning: 'from', transliteration: 'me', variants: ['me', 'm'] },
  'on': { meaning: 'on', transliteration: 'al', variants: ['al'] },
};

/**
 * Convert a sentence object to a reading text format
 * @param {Object} sentence - Sentence object
 * @returns {Object} Reading text format
 */
function convertSentenceToReadingText(sentence) {
  // Convert sentence words to tokens
  const tokens = [];
  const translations = { en: {} };
  const glosses = { en: {} };
  let lastEnd = -1;

  sentence.words.forEach((word, idx) => {
    // Add punctuation/gaps between words
    if (word.start > lastEnd + 1) {
      const gapText = sentence.hebrew.slice(lastEnd + 1, word.start);
      if (gapText.trim()) {
        tokens.push({ type: 'punct', text: gapText });
      }
    }

    // Use wordId if available, otherwise generate one
    const wordId = word.wordId || `word-${idx}`;

    // Add word token
    tokens.push({
      type: 'word',
      text: word.surface || word.hebrew,
      id: wordId
    });

    // Add translation (transliteration for pronunciation) and gloss (meaning)
    if (wordId) {
      const dictEntry = wordDictionary[wordId];

      if (dictEntry) {
        // Use dictionary data if available
        translations.en[wordId] = {
          canonical: dictEntry.transliteration,
          variants: dictEntry.variants
        };
        glosses.en[wordId] = dictEntry.meaning;
      } else {
        // Fallback: use wordId as both transliteration and meaning
        translations.en[wordId] = {
          canonical: wordId,
          variants: [wordId]
        };
        glosses.en[wordId] = wordId.charAt(0).toUpperCase() + wordId.slice(1);
      }
    }

    lastEnd = word.end;
  });

  // Add trailing punctuation if any
  if (lastEnd < sentence.hebrew.length - 1) {
    const trailing = sentence.hebrew.slice(lastEnd + 1);
    if (trailing.trim()) {
      tokens.push({ type: 'punct', text: trailing });
    }
  }

  // Create reading text object
  return {
    id: `sentence-${sentence.id}`,
    title: {
      en: sentence.english
    },
    subtitle: {
      en: `Difficulty ${sentence.difficulty} · ${sentence.theme}`
    },
    practiceLanguage: 'hebrew',
    sectionId: 'sentences',
    tokens,
    translations,
    glosses,
    meaningKeys: {}, // Could add i18n keys later
    fullSentenceAnswer: {
      en: {
        canonical: sentence.english,
        variants: [sentence.english], // Can add more variants later
        pattern: sentence.pattern // Include pattern for flexible grading
      }
    }
  };
}

/**
 * Cafe Talk texts by language
 */
const cafeTalkByLanguage = {
  hebrew: hebrewCafeTalkTexts,
  arabic: arabicCafeTalkTexts,
  mandarin: mandarinCafeTalkTexts,
  hindi: hindiCafeTalkTexts,
  english: englishCafeTalkTexts,
  spanish: spanishCafeTalkTexts,
  french: frenchCafeTalkTexts,
  portuguese: portugueseCafeTalkTexts,
  russian: russianCafeTalkTexts,
  japanese: japaneseCafeTalkTexts,
  bengali: bengaliCafeTalkTexts,
  amharic: amharicCafeTalkTexts
};

// Cafe Talk validation disabled: data has incomplete placeholders and
// this app is now kids-focused (cafeTalk adult reading path not in use).

/**
 * Aggregate all reading texts by practice language
 * This maintains backward compatibility with existing code
 */
export const readingTextsByLanguage = {
  hebrew: hebrewReadingTexts,
  arabic: arabicReadingTexts,
  mandarin: mandarinReadingTexts,
  hindi: hindiReadingTexts,
  english: englishReadingTexts,
  spanish: spanishReadingTexts,
  french: frenchReadingTexts,
  portuguese: portugueseReadingTexts,
  russian: russianReadingTexts,
  japanese: japaneseReadingTexts,
  bengali: bengaliReadingTexts,
  amharic: amharicReadingTexts
};

/**
 * Get all reading texts for a specific practice language
 * Includes both Starter and Cafe Talk sections with sectionId
 * @param {string} practiceLanguage - Language ID
 * @returns {Array} Reading texts for that language with sectionId
 */
export function getReadingTextsForLanguage(practiceLanguage) {
  const normalizedLanguage = normalizeLanguageId(practiceLanguage);
  const starterTexts = readingTextsByLanguage[normalizedLanguage] || [];
  const cafeTalkTexts = cafeTalkByLanguage[normalizedLanguage] || [];

  // Add module vocab and grammar texts for Hebrew
  const moduleTexts = normalizedLanguage === 'hebrew'
    ? [...moduleVocabTexts, ...moduleGrammarTexts]
    : [];

  return [
    ...addSectionId(starterTexts, 'starter'),
    ...addSectionId(cafeTalkTexts, 'cafeTalk'),
    ...addSectionId(moduleTexts, 'modules')
  ];
}

/**
 * Get a specific reading text by ID
 * If a practice language is provided, prefer texts from that language.
 * @param {string} textId - Text ID
 * @param {string} [practiceLanguage] - Optional practice language ID to scope the lookup
 * @returns {Object|null} Reading text object or null
 */
export function getReadingTextById(textId, practiceLanguage) {
  const normalizedLanguage = normalizeLanguageId(practiceLanguage);

  // Handle sentence IDs (e.g., "sentence-greetings-1")
  if (textId.startsWith('sentence-')) {
    const sentenceId = textId.replace('sentence-', '');
    const sentence = allSentences.find(s => s.id === sentenceId);
    if (sentence) {
      return convertSentenceToReadingText(sentence);
    }
  }

  // If a practice language is specified, look there first
  if (normalizedLanguage) {
    const starterTexts = readingTextsByLanguage[normalizedLanguage];
    if (starterTexts) {
      const text = starterTexts.find(t => t.id === textId);
      if (text) return { ...text, sectionId: text.sectionId || 'starter' };
    }

    const cafeTalkTexts = cafeTalkByLanguage[normalizedLanguage];
    if (cafeTalkTexts) {
      const text = cafeTalkTexts.find(t => t.id === textId);
      if (text) return { ...text, sectionId: text.sectionId || 'cafeTalk' };
    }

    // Search module texts for Hebrew
    if (normalizedLanguage === 'hebrew') {
      const moduleText = [...moduleVocabTexts, ...moduleGrammarTexts].find(t => t.id === textId);
      if (moduleText) return { ...moduleText, sectionId: moduleText.sectionId || 'modules' };
    }
  }

  // Fallback: search across all languages (maintains backward compatibility)
  for (const texts of Object.values(readingTextsByLanguage)) {
    const text = texts.find(t => t.id === textId);
    if (text) return { ...text, sectionId: text.sectionId || 'starter' };
  }

  for (const texts of Object.values(cafeTalkByLanguage)) {
    const text = texts.find(t => t.id === textId);
    if (text) return { ...text, sectionId: text.sectionId || 'cafeTalk' };
  }

  // Fallback: search module texts
  const moduleText = [...moduleVocabTexts, ...moduleGrammarTexts].find(t => t.id === textId);
  if (moduleText) return { ...moduleText, sectionId: moduleText.sectionId || 'modules' };

  return null;
}

// Re-export individual language arrays for direct access
export {
  hebrewReadingTexts,
  arabicReadingTexts,
  mandarinReadingTexts,
  hindiReadingTexts,
  englishReadingTexts,
  spanishReadingTexts,
  frenchReadingTexts,
  portugueseReadingTexts,
  russianReadingTexts,
  japaneseReadingTexts,
  bengaliReadingTexts,
  amharicReadingTexts
};
