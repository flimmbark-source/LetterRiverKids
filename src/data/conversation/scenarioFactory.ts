/**
 * Conversation Scenario Factory
 *
 * Converts sentences from sentencesByTheme into conversation scenarios
 * with lines, transliterations, and acceptable variants.
 */

import type { Sentence } from '../../types/sentences.ts';
import type {
  ConversationLine,
  ConversationScenario,
  ConversationScenarioMetadata,
  ConversationPracticePlan,
  ConversationBeat,
  ConversationModuleType,
  PracticeSegment
} from './types.ts';
import { cafeTalkTransliterations } from '../readingTexts/cafeTalk/lexicon/hebrew.js';

/**
 * English meanings for Hebrew words
 * Maps both Hebrew words and wordIds to their English meanings
 */
export const sentenceMeaningsLookup: Record<string, string> = {
  // From baseWordIdLookup in sentences/index.ts
  // Hebrew words as keys
  'שלום': 'hello, peace',
  'תודה': 'thank you',
  'כן': 'yes',
  'לא': 'no',
  'יש': 'there is/are',
  'כל': 'all, every',
  'לי': 'to me',
  'אני': 'I',
  'ואני': 'and I',
  'אתה': 'you (m)',
  'ואתה': 'and you (m)',
  'את': 'you (f)',
  'הוא': 'he',
  'היא': 'she',
  'אנחנו': 'we',
  'הם': 'they',
  'דני': '(name)',
  'אורי': '(name)',
  'חבר': 'friend',
  'החבר': 'the friend',
  'משפחה': 'family',
  'שכן': 'neighbor',
  'ילד': 'child',
  'הילד': 'the child',
  'שפה': 'language',
  'מילה': 'word',
  'בית': 'home, house',
  'הבית': 'the home',
  'בבית': 'at home',
  'לבית': 'to home',
  'רעיון': 'idea',
  'שאלה': 'question',
  'תשובה': 'answer',
  'התשובה': 'the answer',
  'ספר': 'book',
  'הספר': 'the book',
  'אוכל': 'food',
  'האוכל': 'the food',
  'מים': 'water',
  'קפה': 'coffee',
  'וקפה': 'and coffee',
  'עיר': 'city',
  'לעיר': 'to the city',
  'בעיר': 'in the city',
  'היום': 'today',
  'מחר': 'tomorrow',
  'אתמול': 'yesterday',
  'עכשיו': 'now',
  'זמן': 'time',
  'הזמן': 'the time',
  'יום': 'day',
  'בוקר': 'morning',
  'בבוקר': 'in the morning',
  'ערב': 'evening',
  'בערב': 'in the evening',
  'מוקדם': 'early',
  'מאוחר': 'late',
  'תמיד': 'always',
  'לפעמים': 'sometimes',
  'נהדר': 'great',
  'טוב': 'good',
  'שמח': 'happy',
  'נחמד': 'nice',
  'יפה': 'beautiful',
  'רוצה': 'want',
  'צריך': 'need',
  'בא': 'come',
  'באים': 'come (pl)',
  'להגיע': 'to arrive',
  'מגיעים': 'arrive (pl)',
  'מחכה': 'waiting',
  'חיכינו': 'we waited',
  'לחכות': 'to wait',
  'לשאול': 'to ask',
  'לומר': 'to say',
  'ללמוד': 'to study',
  'לומדים': 'studying',
  'לקרוא': 'to read',
  'קורא': 'reading',
  'לאכול': 'to eat',
  'לשתות': 'to drink',
  'שותה': 'drinking',
  'שותים': 'drinking (pl)',
  'ושותה': 'and drink',
  'לקנות': 'to buy',
  'קונים': 'buying',
  'לשלם': 'to pay',
  'משלם': 'paying',
  'לעזור': 'to help',
  'עוזר': 'helping',
  'להתחיל': 'to start',
  'מתחילה': 'starting',
  'לסיים': 'to finish',
  'מסיימים': 'finishing',
  'ללכת': 'to go',
  'הולך': 'going',
  'להכיר': 'to meet',
  'מאיפה': 'from where',
  'חדש': 'new (m)',
  'שבאת': 'that you came',
  'לך': 'to you',
  'שאתה': 'that you',
  'כאן': 'here',
  'איתנו': 'with us',
  'חדשה': 'new (f)',
  'יחד': 'together',
  'איך': 'how',
  'שלך': 'yours',
  'קצרה': 'short (f)',
  'קצר': 'short (m)',
  'על': 'about, on',
  'זה': 'this',
  'שמי': 'my name',
  'אוהב': 'love (m)',
  'עם': 'with',
  'חברים': 'friends',
  'שלנו': 'ours',
  'מלא': 'full',
  'במשפחה': 'in family',
  'וחברים': 'and friends',
  'אוהבים': 'love (pl)',
  'לשבת': 'to sit',
  'לדבר': 'to speak',
  'ולדבר': 'and to speak',
  'שקט': 'quiet',
  'ושקט': 'and quiet',
  'לנו': 'to us',
  'קטן': 'small',
  'בחדר': 'in room',
  'שלו': 'his',
  'במטבח': 'in kitchen',
  'גר': 'live',
  'ליד': 'near',
  'חם': 'warm',
  'קרים': 'cold (pl)',
  'אוהבת': 'love (f)',
  'במסעדה': 'at restaurant',
  'טעים': 'tasty',
  'מאוד': 'very',
  'לחם': 'bread',
  'טרי': 'fresh',
  'המשפחה': 'the family',
  'מבשל': 'cooking',
  'עוד': 'more',
  'בבקשה': 'please',
  'מזמינים': 'ordering',
  'נוסף': 'another',
  'ארוחת': 'meal of',
  'לארוחת': 'for meal',
  'הרבה': 'a lot',
  'בתחנה': 'at station',
  'כדי': 'in order to',
  'לנוח': 'to rest',
  'פגישה': 'meeting',
  'לפגישה': 'to meeting',
  'הפגישה': 'the meeting',
  'בדיוק': 'exactly',
  'אחרי': 'after',
  'עשר': 'ten',
  'חמש': 'five',
  'דקות': 'minutes',
  'מדי': 'too',
  'שעה': 'hour',
  'בשעה': 'at hour',

  // WordIds from baseWordIdLookup as keys (these are the English IDs used internally)
  'shalom': 'hello, peace',
  'todah': 'thank you',
  'ken': 'yes',
  'no': 'no',
  'I': 'I',
  'you': 'you',
  'he': 'he',
  'she': 'she',
  'we': 'we',
  'they': 'they',
  'Dani': '(name)',
  'friend': 'friend',
  'family': 'family',
  'neighbor': 'neighbor',
  'child': 'child',
  'language': 'language',
  'word': 'word',
  'home': 'home, house',
  'idea': 'idea',
  'question': 'question',
  'answer': 'answer',
  'book': 'book',
  'food': 'food',
  'water': 'water',
  'coffee': 'coffee',
  'city': 'city',
  'today': 'today',
  'tomorrow': 'tomorrow',
  'yesterday': 'yesterday',
  'now': 'now',
  'time': 'time',
  'day': 'day',
  'boker': 'morning',
  'erev': 'evening',
  'early': 'early',
  'late': 'late',
  'always': 'always',
  'sometimes': 'sometimes',
  'great': 'great',
  'tov': 'good',
  'happy': 'happy',
  'nice': 'nice',
  'beautiful': 'beautiful',
  'want': 'want',
  'need': 'need',
  'ba': 'come',
  'baim': 'come (pl)',
  'lehagia': 'to arrive',
  'magiim': 'arrive (pl)',
  'mechake': 'waiting',
  'chikinu': 'we waited',
  'lechakot': 'to wait',
  'lishol': 'to ask',
  'lomar': 'to say',
  'lilmod': 'to study',
  'lomdim': 'studying',
  'likro': 'to read',
  'kore': 'reading',
  'leechol': 'to eat',
  'lishtot': 'to drink',
  'shote': 'drinking',
  'shotim': 'drinking (pl)',
  'liknot': 'to buy',
  'konim': 'buying',
  'leshalem': 'to pay',
  'meshalem': 'paying',
  'laazor': 'to help',
  'ozer': 'helping',
  'lehatkhil': 'to start',
  'matkhila': 'starting',
  'lesayem': 'to finish',
  'mesayemim': 'finishing',
  'lalechet': 'to go',
  'holech': 'going',
  'meet': 'to meet',
  'where-from': 'from where',
  'new': 'new',
  'you-came': 'that you came',
  'to-you': 'to you',
  'that-you': 'that you',
  'here': 'here',
  'with-us': 'with us',
  'new-f': 'new (f)',
  'together': 'together',
  'how': 'how',
  'yours': 'yours',
  'short': 'short',
  'about': 'about, on',
  'this': 'this',
  'my-name': 'my name',
  'love': 'love',
  'with': 'with',
  'friends': 'friends',
  'ours': 'ours',
  'full': 'full',
  'in-family': 'in family',
  'and-friends': 'and friends',
  'like': 'like, love (pl)',
  'sit': 'to sit',
  'speak': 'to speak',
  'quiet': 'quiet',
  'to-us': 'to us',
  'small': 'small',
  'in-room': 'in room',
  'his': 'his',
  'in-kitchen': 'in kitchen',
  'live': 'live',
  'near': 'near',
  'warm': 'warm',
  'cold-pl': 'cold',
  'love-f': 'love (f)',
  'restaurant': 'at restaurant',
  'tasty': 'tasty',
  'very': 'very',
  'bread': 'bread',
  'fresh': 'fresh',
  'the-family': 'the family',
  'cook': 'cooking',
  'more': 'more',
  'please': 'please',
  'order': 'ordering',
  'another': 'another',
  'meal-of': 'meal of',
  'a-lot': 'a lot',
  'at-station': 'at station',
  'in-order-to': 'in order to',
  'rest': 'to rest',
  'meeting': 'meeting',
  'exactly': 'exactly',
  'after': 'after',
  'ten': 'ten',
  'minutes': 'minutes',
  'too': 'too',
  'hour': 'hour'
};

/**
 * Simple transliteration lookup extending cafeTalk with sentence-specific words
 */
export const sentenceTransliterationLookup: Record<string, string> = {
  // From baseWordIdLookup in sentences/index.ts
  'שלום': 'shalom',
  'תודה': 'todah',
  'כן': 'ken',
  'לא': 'lo',
  'יש': 'yesh',
  'כל': 'kol',
  'לי': 'li',
  'אני': 'ani',
  'ואני': 've-ani',
  'אתה': 'ata',
  'ואתה': 've-ata',
  'את': 'at',
  'הוא': 'hu',
  'היא': 'hi',
  'אנחנו': 'anachnu',
  'הם': 'hem',
  'דני': 'Dani',
  'אורי': 'Uri',
  'חבר': 'chaver',
  'החבר': 'ha-chaver',
  'משפחה': 'mishpacha',
  'שכן': 'shachen',
  'ילד': 'yeled',
  'הילד': 'ha-yeled',
  'שפה': 'safa',
  'מילה': 'mila',
  'בית': 'bayit',
  'הבית': 'ha-bayit',
  'בבית': 'ba-bayit',
  'לבית': 'la-bayit',
  'רעיון': 'rayon',
  'שאלה': 'sheela',
  'תשובה': 'tshuva',
  'התשובה': 'ha-tshuva',
  'ספר': 'sefer',
  'הספר': 'ha-sefer',
  'אוכל': 'ochel',
  'האוכל': 'ha-ochel',
  'מים': 'mayim',
  'קפה': 'kafe',
  'וקפה': 've-kafe',
  'עיר': 'ir',
  'לעיר': 'la-ir',
  'בעיר': 'ba-ir',
  'היום': 'ha-yom',
  'מחר': 'machar',
  'אתמול': 'etmol',
  'עכשיו': 'achshav',
  'זמן': 'zman',
  'הזמן': 'ha-zman',
  'יום': 'yom',
  'בוקר': 'boker',
  'בבוקר': 'ba-boker',
  'ערב': 'erev',
  'בערב': 'ba-erev',
  'מוקדם': 'mukdam',
  'מאוחר': 'meuchar',
  'תמיד': 'tamid',
  'לפעמים': 'lifamim',
  'נהדר': 'nehedar',
  'טוב': 'tov',
  'שמח': 'sameach',
  'נחמד': 'nechmad',
  'יפה': 'yafe',
  'רוצה': 'rotze',
  'צריך': 'tzarich',
  'בא': 'ba',
  'באים': 'baim',
  'להגיע': 'lehagia',
  'מגיעים': 'magiim',
  'מחכה': 'mechake',
  'חיכינו': 'chikinu',
  'לחכות': 'lechakot',
  'לשאול': 'lishol',
  'לומר': 'lomar',
  'ללמוד': 'lilmod',
  'לומדים': 'lomdim',
  'לקרוא': 'likro',
  'קורא': 'kore',
  'לאכול': 'leechol',
  'לשתות': 'lishtot',
  'שותה': 'shote',
  'ושותה': 've-shote',
  'שותים': 'shotim',
  'לקנות': 'liknot',
  'קונים': 'konim',
  'לשלם': 'leshalem',
  'משלם': 'meshalem',
  'לעזור': 'laazor',
  'עוזר': 'ozer',
  'להתחיל': 'lehatkhil',
  'מתחילה': 'matkhila',
  'לסיים': 'lesayem',
  'מסיימים': 'mesayemim',
  'ללכת': 'lalechet',
  'הולך': 'holech',
  'להכיר': 'lehakir',
  'מאיפה': 'meeifo',
  'חדש': 'chadash',
  'שבאת': 'shebata',
  'לך': 'lecha',
  'שאתה': 'she-ata',
  'כאן': 'kan',
  'איתנו': 'itanu',
  'חדשה': 'chadasha',
  'יחד': 'yachad',
  'איך': 'eich',
  'שלך': 'shelcha',
  'קצרה': 'ktzara',
  'קצר': 'katzar',
  'על': 'al',
  'זה': 'ze',
  'שמי': 'shmi',
  'אוהב': 'ohev',
  'עם': 'im',
  'חברים': 'chaverim',
  'שלנו': 'shelanu',
  'מלא': 'male',
  'במשפחה': 'ba-mishpacha',
  'וחברים': 've-chaverim',
  'אוהבים': 'ohavim',
  'לשבת': 'lashevet',
  'לדבר': 'ledaber',
  'ולדבר': 've-ledaber',
  'שקט': 'shaket',
  'ושקט': 've-shaket',
  'לנו': 'lanu',
  'קטן': 'katan',
  'בחדר': 'ba-cheder',
  'שלו': 'shelo',
  'במטבח': 'ba-mitbach',
  'גר': 'gar',
  'ליד': 'leyad',
  'חם': 'cham',
  'קרים': 'karim',
  'אוהבת': 'ohevet',
  'במסעדה': 'ba-misada',
  'טעים': 'taim',
  'מאוד': 'meod',
  'לחם': 'lechem',
  'טרי': 'tari',
  'המשפחה': 'ha-mishpacha',
  'מבשל': 'mevashel',
  'עוד': 'od',
  'בבקשה': 'bevakasha',
  'מזמינים': 'mazminem',
  'נוסף': 'nosaf',
  'ארוחת': 'aruchat',
  'לארוחת': 'le-aruchat',
  'הרבה': 'harbe',
  'בתחנה': 'ba-tachana',
  'כדי': 'kedei',
  'לנוח': 'lanuach',
  'פגישה': 'pgisha',
  'לפגישה': 'la-pgisha',
  'הפגישה': 'ha-pgisha',
  'בדיוק': 'bediyuk',
  'אחרי': 'acharei',
  'עשר': 'eser',
  'חמש': 'chamesh',
  'דקות': 'dakot',
  'מדי': 'midai',
  'שעה': 'shaa',
  'בשעה': 'ba-shaa',

  // WordIds from baseWordIdLookup as keys
  'shalom': 'shalom',
  'todah': 'todah',
  'ken': 'ken',
  'no': 'lo',
  'I': 'ani',
  'you': 'ata',
  'he': 'hu',
  'she': 'hi',
  'we': 'anachnu',
  'they': 'hem',
  'Dani': 'Dani',
  'friend': 'chaver',
  'family': 'mishpacha',
  'neighbor': 'shachen',
  'child': 'yeled',
  'language': 'safa',
  'word': 'mila',
  'home': 'bayit',
  'idea': 'rayon',
  'question': 'sheela',
  'answer': 'tshuva',
  'book': 'sefer',
  'food': 'ochel',
  'water': 'mayim',
  'coffee': 'kafe',
  'city': 'ir',
  'today': 'ha-yom',
  'tomorrow': 'machar',
  'yesterday': 'etmol',
  'now': 'achshav',
  'time': 'zman',
  'day': 'yom',
  'boker': 'boker',
  'erev': 'erev',
  'early': 'mukdam',
  'late': 'meuchar',
  'always': 'tamid',
  'sometimes': 'lifamim',
  'great': 'nehedar',
  'tov': 'tov',
  'happy': 'sameach',
  'nice': 'nechmad',
  'beautiful': 'yafe',
  'want': 'rotze',
  'need': 'tzarich',
  'ba': 'ba',
  'baim': 'baim',
  'lehagia': 'lehagia',
  'magiim': 'magiim',
  'mechake': 'mechake',
  'chikinu': 'chikinu',
  'lechakot': 'lechakot',
  'lishol': 'lishol',
  'lomar': 'lomar',
  'lilmod': 'lilmod',
  'lomdim': 'lomdim',
  'likro': 'likro',
  'kore': 'kore',
  'leechol': 'leechol',
  'lishtot': 'lishtot',
  'shote': 'shote',
  'shotim': 'shotim',
  'liknot': 'liknot',
  'konim': 'konim',
  'leshalem': 'leshalem',
  'meshalem': 'meshalem',
  'laazor': 'laazor',
  'ozer': 'ozer',
  'lehatkhil': 'lehatkhil',
  'matkhila': 'matkhila',
  'lesayem': 'lesayem',
  'mesayemim': 'mesayemim',
  'lalechet': 'lalechet',
  'holech': 'holech',
  'meet': 'lehakir',
  'where-from': 'meeifo',
  'new': 'chadash',
  'you-came': 'shebata',
  'to-you': 'lecha',
  'that-you': 'she-ata',
  'here': 'kan',
  'with-us': 'itanu',
  'new-f': 'chadasha',
  'together': 'yachad',
  'how': 'eich',
  'yours': 'shelcha',
  'short': 'katzar',
  'about': 'al',
  'this': 'ze',
  'my-name': 'shmi',
  'love': 'ohev',
  'with': 'im',
  'friends': 'chaverim',
  'ours': 'shelanu',
  'full': 'male',
  'in-family': 'ba-mishpacha',
  'and-friends': 've-chaverim',
  'like': 'ohavim',
  'sit': 'lashevet',
  'speak': 'ledaber',
  'quiet': 'shaket',
  'to-us': 'lanu',
  'small': 'katan',
  'in-room': 'ba-cheder',
  'his': 'shelo',
  'in-kitchen': 'ba-mitbach',
  'live': 'gar',
  'near': 'leyad',
  'warm': 'cham',
  'cold-pl': 'karim',
  'love-f': 'ohevet',
  'restaurant': 'ba-misada',
  'tasty': 'taim',
  'very': 'meod',
  'bread': 'lechem',
  'fresh': 'tari',
  'the-family': 'ha-mishpacha',
  'cook': 'mevashel',
  'more': 'od',
  'please': 'bevakasha',
  'order': 'mazminem',
  'another': 'nosaf',
  'meal-of': 'aruchat',
  'a-lot': 'harbe',
  'at-station': 'ba-tachana',
  'in-order-to': 'kedei',
  'rest': 'lanuach',
  'meeting': 'pgisha',
  'exactly': 'bediyuk',
  'after': 'acharei',
  'ten': 'eser',
  'minutes': 'dakot',
  'too': 'midai',
  'hour': 'shaa',

  ...cafeTalkTransliterations // Extend with cafeTalk transliterations
};

/**
 * Generate transliteration for a Hebrew sentence by matching words
 */
function generateTransliteration(hebrewSentence: string): string {
  // Simple word-by-word transliteration
  const words = hebrewSentence.split(/[\s,\.!?]+/).filter(w => w.length > 0);
  const transliterated = words.map(word => {
    // Remove punctuation
    const cleanWord = word.replace(/[,\.!?،؛]/g, '');
    const transliteration = sentenceTransliterationLookup[cleanWord];

    if (!transliteration) {
      // Log warning for missing transliteration
      console.warn(`Missing transliteration for Hebrew word: "${cleanWord}"`);
      // Return placeholder instead of Hebrew text
      return `[${cleanWord}]`;
    }

    return transliteration;
  });

  return transliterated.join(' ');
}

/**
 * Parse pattern string to extract acceptable variants
 * Pattern format: "{Hi, Hello}, {I'm, I am} Dani..."
 */
function parsePatternVariants(pattern: string): string[] {
  if (!pattern) return [];

  const variants: string[] = [pattern];

  // Find all {option1, option2, ...} groups
  const groupRegex = /\{([^}]+)\}/g;
  const groups: { text: string; options: string[] }[] = [];
  let match;

  while ((match = groupRegex.exec(pattern)) !== null) {
    const options = match[1].split(',').map(opt => opt.trim());
    groups.push({
      text: match[0],
      options
    });
  }

  // Generate all combinations
  if (groups.length === 0) return [pattern];

  function generateCombinations(baseText: string, remainingGroups: typeof groups): string[] {
    if (remainingGroups.length === 0) return [baseText];

    const [currentGroup, ...restGroups] = remainingGroups;
    const results: string[] = [];

    for (const option of currentGroup.options) {
      const newText = baseText.replace(currentGroup.text, option);
      results.push(...generateCombinations(newText, restGroups));
    }

    return results;
  }

  return generateCombinations(pattern, groups);
}

/**
 * Convert a Sentence to a ConversationLine
 */
export function sentenceToLine(sentence: Sentence): ConversationLine {
  const transliteration = generateTransliteration(sentence.hebrew);
  const englishVariants = sentence.pattern
    ? parsePatternVariants(sentence.pattern)
    : [sentence.english];

  return {
    id: sentence.id,
    he: sentence.hebrew,
    tl: transliteration,
    en: sentence.english,
    acceptableVariants: {
      hebrew: [sentence.hebrew],
      english: englishVariants,
      transliteration: [transliteration]
    },
    sentenceData: sentence
  };
}

/**
 * Default practice plan: each line practices with all four modules
 */
const DEFAULT_MODULE_SEQUENCE: ConversationModuleType[] = [
  'listenMeaningChoice',
  'shadowRepeat',
  'guidedReplyChoice',
  'typeInput'
];

/**
 * Generate default practice plan for a scenario
 */
function generateDefaultPlan(
  scenarioId: string,
  lines: ConversationLine[]
): ConversationPracticePlan {
  const beats: ConversationBeat[] = [];

  // For each line, add all four modules in sequence
  for (const line of lines) {
    for (const moduleId of DEFAULT_MODULE_SEQUENCE) {
      beats.push({
        lineId: line.id,
        moduleId
      });
    }
  }

  return {
    scenarioId,
    beats,
    planName: 'default'
  };
}

/**
 * Create scenario metadata from theme info
 */
function createScenarioMetadata(
  themeKey: string,
  sentences: Sentence[],
  source: 'sentencesByTheme' | 'cafeTalk'
): ConversationScenarioMetadata {
  const avgDifficulty = sentences.reduce((sum, s) => sum + s.difficulty, 0) / sentences.length;

  // Generate i18n keys
  const themeSlug = themeKey.toLowerCase().replace(/[^\w]+/g, '-');

  return {
    id: `conversation-${themeSlug}`,
    theme: themeKey,
    titleKey: `conversation.scenarios.${themeSlug}.title`,
    subtitleKey: `conversation.scenarios.${themeSlug}.subtitle`,
    lineCount: sentences.length,
    difficulty: Math.round(avgDifficulty),
    source
  };
}

/**
 * Generate practice segments from paired sentences
 * Detects sentence pairs (sentences ending in -short paired with their base version)
 * Groups pairs into segments (2 pairs per segment = 4 sentences per segment)
 */
export function generateSegmentsFromSentences(
  scenarioId: string,
  sentences: Sentence[],
  lines: ConversationLine[]
): PracticeSegment[] | undefined {
  const segments: PracticeSegment[] = [];
  const linesMap = new Map(lines.map(line => [line.id, line]));

  // Group sentences into pairs
  const shortSentences = sentences.filter(s => s.id.endsWith('-short'));

  if (shortSentences.length === 0) {
    // No paired structure detected
    return undefined;
  }

  // First, create all sentence pairs
  const allPairs: Array<{ shortSentenceId: string; longSentenceId: string }> = [];

  for (const shortSentence of shortSentences) {
    const baseId = shortSentence.id.replace('-short', '');
    const longSentence = sentences.find(s => s.id === baseId);

    if (!longSentence) {
      console.warn(`No matching long sentence found for ${shortSentence.id}`);
      continue;
    }

    allPairs.push({
      shortSentenceId: shortSentence.id,
      longSentenceId: longSentence.id
    });
  }

  // Group pairs into segments (2 pairs per segment)
  const pairsPerSegment = 2;
  const numSegments = Math.ceil(allPairs.length / pairsPerSegment);

  for (let segIdx = 0; segIdx < numSegments; segIdx++) {
    const startIdx = segIdx * pairsPerSegment;
    const endIdx = Math.min(startIdx + pairsPerSegment, allPairs.length);
    const segmentPairs = allPairs.slice(startIdx, endIdx);

    // Create practice plan for this segment
    const segmentBeats: ConversationBeat[] = [];
    const moduleSequence: ConversationModuleType[] = [
      'listenMeaningChoice',
      'shadowRepeat',
      'guidedReplyChoice',
      'typeInput'
    ];

    // For each pair in the segment, add beats in order: short1, long1, short2, long2
    for (const pair of segmentPairs) {
      // Add beats for short sentence
      for (const moduleId of moduleSequence) {
        segmentBeats.push({
          lineId: pair.shortSentenceId,
          moduleId
        });
      }

      // Add beats for long sentence
      for (const moduleId of moduleSequence) {
        segmentBeats.push({
          lineId: pair.longSentenceId,
          moduleId
        });
      }
    }

    const segment: PracticeSegment = {
      id: `${scenarioId}-segment-${segIdx + 1}`,
      index: segIdx,
      pairs: segmentPairs,
      plan: {
        scenarioId,
        beats: segmentBeats,
        planName: `segment-${segIdx + 1}`
      },
      title: `Segment ${segIdx + 1}`
    };

    console.log(`Generated Segment ${segIdx + 1}:`, {
      pairs: segmentPairs.map(p => `${p.shortSentenceId}+${p.longSentenceId}`),
      beatCount: segmentBeats.length,
      firstBeatLineId: segmentBeats[0]?.lineId
    });

    segments.push(segment);
  }

  return segments.length > 0 ? segments : undefined;
}

/**
 * Convert a theme's sentences into a conversation scenario
 */
export function createScenarioFromTheme(
  themeKey: string,
  sentences: Sentence[]
): ConversationScenario {
  const metadata = createScenarioMetadata(themeKey, sentences, 'sentencesByTheme');
  const lines = sentences.map(sentenceToLine);
  const defaultPlan = generateDefaultPlan(metadata.id, lines);
  const segments = generateSegmentsFromSentences(metadata.id, sentences, lines);

  return {
    metadata,
    lines,
    defaultPlan,
    segments
  };
}

/**
 * Generate all conversation scenarios from sentencesByTheme
 */
export function buildAllScenarios(
  sentencesByTheme: Record<string, Sentence[]>
): ConversationScenario[] {
  return Object.entries(sentencesByTheme).map(([themeKey, sentences]) =>
    createScenarioFromTheme(themeKey, sentences)
  );
}
