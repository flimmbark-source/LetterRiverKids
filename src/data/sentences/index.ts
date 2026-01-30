import type { Sentence, SentenceWord } from '../../types/sentences.ts';
import { tokenizeHebrewSentence } from '../../lib/sentenceTokenizer.ts';

const baseWordIdLookup: Record<string, string> = {
  שלום: 'shalom',
  תודה: 'todah',
  כן: 'ken',
  לא: 'no',
  אני: 'I',
  אתה: 'you',
  את: 'you',
  הוא: 'he',
  היא: 'she',
  אנחנו: 'we',
  הם: 'they',

  // Names
  דני: 'Dani',
  חבר: 'friend',
  משפחה: 'family',
  שכן: 'neighbor',
  ילד: 'child',
  שפה: 'language',
  מילה: 'word',
  בית: 'home',
  הבית: 'home',
  בבית: 'home',
  לבית: 'home',
  רעיון: 'idea',
  שאלה: 'question',
  תשובה: 'answer',
  ספר: 'book',
  אוכל: 'food',
  מים: 'water',
  קפה: 'coffee',
  עיר: 'city',
  לעיר: 'city',
  בעיר: 'city',
  היום: 'today',
  מחר: 'tomorrow',
  אתמול: 'yesterday',
  עכשיו: 'now',
  זמן: 'time',
  יום: 'day',
  בוקר: 'boker',
  בבוקר: 'boker',
  ערב: 'erev',
  בערב: 'erev',
  מוקדם: 'early',
  מאוחר: 'late',
  תמיד: 'always',
  לפעמים: 'sometimes',
  נהדר: 'great',
  טוב: 'tov',
  שמח: 'happy',
  נחמד: 'nice',
  יפה: 'beautiful',
  רוצה: 'want',
  צריך: 'need',
  בא: 'ba',
  באים: 'baim',
  להגיע: 'lehagia',
  מגיעים: 'magiim',
  מחכה: 'mechake',
  חיכינו: 'chikinu',
  לחכות: 'lechakot',
  לשאול: 'lishol',
  לומר: 'lomar',
  ללמוד: 'lilmod',
  לומדים: 'lomdim',
  לקרוא: 'likro',
  קורא: 'kore',
  לאכול: 'leechol',
  לשתות: 'lishtot',
  שותה: 'shote',
  שותים: 'shotim',
  לקנות: 'liknot',
  קונים: 'konim',
  לשלם: 'leshalem',
  משלם: 'meshalem',
  לעזור: 'laazor',
  עוזר: 'ozer',
  להתחיל: 'lehatkhil',
  מתחילה: 'matkhila',
  לסיים: 'lesayem',
  מסיימים: 'mesayemim',
  ללכת: 'lalechet',
  הולך: 'holech',
  להכיר: 'meet',
  מאיפה: 'where-from',
  חדש: 'new',
  שבאת: 'you-came',
  לך: 'to-you',
  שאתה: 'that-you',
  כאן: 'here',
  איתנו: 'with-us',
  חדשה: 'new-f',
  יחד: 'together',
  איך: 'how',
  שלך: 'yours',
  קצרה: 'short',
  על: 'about',
  זה: 'this',
  שמי: 'my-name',
  אוהב: 'love',
  עם: 'with',
  חברים: 'friends',
  שלנו: 'ours',
  מלא: 'full',
  במשפחה: 'in-family',
  וחברים: 'and-friends',
  אוהבים: 'like',
  לשבת: 'sit',
  לדבר: 'speak',
  שקט: 'quiet',
  לנו: 'to-us',
  קטן: 'small',
  בחדר: 'in-room',
  שלו: 'his',
  במטבח: 'in-kitchen',
  גר: 'live',
  ליד: 'near',
  חם: 'warm',
  קרים: 'cold-pl',
  אוהבת: 'love-f',
  במסעדה: 'restaurant',
  טעים: 'tasty',
  מאוד: 'very',
  לחם: 'bread',
  טרי: 'fresh',
  המשפחה: 'the-family',
  מבשל: 'cook',
  עוד: 'more',
  בבקשה: 'please',
  מזמינים: 'order',
  נוסף: 'another',
  ארוחת: 'meal-of',
  הרבה: 'a-lot',
  בתחנה: 'at-station',
  כדי: 'in-order-to',
  לנוח: 'rest',
  פגישה: 'meeting',
  בדיוק: 'exactly',
  אחרי: 'after',
  עשר: 'ten',
  דקות: 'minutes',
  מדי: 'too',
  שעה: 'hour'
};

function attachWordIds(
  hebrew: string,
  overrides: Record<string, string> = {}
): SentenceWord[] {
  const spans = tokenizeHebrewSentence(hebrew);
  const lookup = { ...baseWordIdLookup, ...overrides };

  return spans.map(span => ({
    ...span,
    wordId: lookup[span.hebrew]
  }));
}

function createSentence(config: {
  id: string;
  hebrew: string;
  english: string;
  pattern?: string;
  theme: string;
  difficulty: Sentence['difficulty'];
  grammarPoints: string[];
  wordIdOverrides?: Record<string, string>;
}): Sentence {
  const words = attachWordIds(config.hebrew, config.wordIdOverrides);

  return {
    ...config,
    words
  };
}

export const sentencesByTheme: Record<string, Sentence[]> = {
  'Greetings & Introductions': [
    // Pair 1: Introduction with name
    createSentence({
      id: 'greetings-1-short',
      hebrew: 'שלום, אני דני.',
      english: "Hi, I'm Dani.",
      pattern: "{Hi, Hello}, {I'm, I am} Dani.",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['greeting', 'simple present']
    }),
    createSentence({
      id: 'greetings-1',
      hebrew: 'שלום, אני דני, שמח להכיר.',
      english: "Hi, I'm Dani, nice to meet you.",
      pattern: "{Hi, Hello}, {I'm, I am} Dani, {nice to meet you, nice meeting you, it's nice to meet you}.",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['greeting', 'simple present']
    }),

    // Pair 2: Being new in the city
    createSentence({
      id: 'greetings-2-short',
      hebrew: 'אני חדש כאן.',
      english: "I'm new here.",
      pattern: "{I'm, I am} new here.",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['simple present', 'location']
    }),
    createSentence({
      id: 'greetings-2',
      hebrew: 'אני חדש בעיר.',
      english: 'I am new in the city.',
      pattern: "{I am, I'm} new in the city.",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['greeting', 'location']
    }),

    // Pair 3: Thanking for coming
    createSentence({
      id: 'greetings-3-short',
      hebrew: 'תודה שבאת.',
      english: 'Thanks for coming.',
      pattern: "{Thanks, Thank you} for coming.",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['gratitude']
    }),
    createSentence({
      id: 'greetings-3',
      hebrew: 'תודה שבאת היום, חיכינו לך.',
      english: 'Thanks for coming today, we were waiting for you.',
      pattern: "{Thanks, Thank you} for coming today, we were waiting for you.",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['gratitude', 'time reference']
    }),

    // Pair 4: Being happy together
    createSentence({
      id: 'greetings-4-short',
      hebrew: 'אני שמח כאן.',
      english: "I'm happy here.",
      pattern: "{I'm, I am} happy here.",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['present tense', 'location']
    }),
    createSentence({
      id: 'greetings-4',
      hebrew: 'אני שמח שאתה כאן איתנו.',
      english: "I'm happy you're here with us.",
      pattern: "{I'm, I am} happy {you're, you are} here with us.",
      theme: 'Greetings & Introductions',
      difficulty: 2,
      grammarPoints: ['present tense', 'present progressive nuance']
    }),

    // Pair 5: Learning language together
    createSentence({
      id: 'greetings-5-short',
      hebrew: 'אנחנו לומדים שפה.',
      english: 'We are learning a language.',
      pattern: "{We are, We're} learning a language.",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['plural subject', 'present progressive']
    }),
    createSentence({
      id: 'greetings-5',
      hebrew: 'אנחנו לומדים שפה חדשה יחד.',
      english: 'We are learning a new language together.',
      pattern: "{We are, We're} learning a new language together.",
      theme: 'Greetings & Introductions',
      difficulty: 2,
      grammarPoints: ['plural subject', 'present progressive nuance']
    }),

    // Pair 6: Asking about the day
    createSentence({
      id: 'greetings-6-short',
      hebrew: 'איך היום?',
      english: "How's today?",
      pattern: "{How's, How is} today?",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['questions', 'time reference']
    }),
    createSentence({
      id: 'greetings-6',
      hebrew: 'איך היום שלך?',
      english: 'How is your day?',
      pattern: "How is your day {today, going}?",
      theme: 'Greetings & Introductions',
      difficulty: 2,
      grammarPoints: ['questions', 'possession']
    }),

    // Pair 7: Asking a question
    createSentence({
      id: 'greetings-7-short',
      hebrew: 'אני רוצה לשאול.',
      english: 'I want to ask.',
      pattern: "I want to ask.",
      theme: 'Greetings & Introductions',
      difficulty: 2,
      grammarPoints: ['verb + infinitive']
    }),
    createSentence({
      id: 'greetings-7',
      hebrew: 'אני רוצה לשאול שאלה קצרה.',
      english: 'I want to ask a quick question.',
      theme: 'Greetings & Introductions',
      difficulty: 3,
      grammarPoints: ['verb + infinitive', 'object noun']
    }),

    // Pair 8: Thanking for answer
    createSentence({
      id: 'greetings-8-short',
      hebrew: 'תודה על התשובה.',
      english: 'Thanks for the answer.',
      pattern: "{Thanks, Thank you} for the answer.",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['gratitude', 'prepositions']
    }),
    createSentence({
      id: 'greetings-8',
      hebrew: 'תודה על התשובה, זה עוזר.',
      english: 'Thanks for the answer, it helps.',
      theme: 'Greetings & Introductions',
      difficulty: 2,
      grammarPoints: ['prepositions', 'noun modifiers']
    }),

    // Pair 9: Having an idea
    createSentence({
      id: 'greetings-9-short',
      hebrew: 'יש לנו רעיון.',
      english: 'We have an idea.',
      pattern: "We have an idea.",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['possession', 'simple present']
    }),
    createSentence({
      id: 'greetings-9',
      hebrew: 'היום יש לנו רעיון טוב להתחיל.',
      english: 'Today we have a good idea to get started.',
      theme: 'Greetings & Introductions',
      difficulty: 2,
      grammarPoints: ['possession', 'adjectives']
    }),

    // Pair 10: Name and learning with friends
    createSentence({
      id: 'greetings-10-short',
      hebrew: 'שמי אורי.',
      english: 'My name is Ori.',
      pattern: "My name is Ori.",
      theme: 'Greetings & Introductions',
      difficulty: 1,
      grammarPoints: ['simple present', 'introduction']
    }),
    createSentence({
      id: 'greetings-10',
      hebrew: 'שמי אורי ואני אוהב ללמוד שפה עם חברים.',
      english: 'My name is Ori and I love to study the language with friends.',
      theme: 'Greetings & Introductions',
      difficulty: 3,
      grammarPoints: ['coordination', 'infinitive phrase']
    })
  ],
  'At Home': [
    // Pair 1: Home is full
    createSentence({
      id: 'home-1-short',
      hebrew: 'הבית שלנו מלא.',
      english: 'Our home is full.',
      pattern: 'Our home is full.',
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['possession', 'adjectives']
    }),
    createSentence({
      id: 'home-1',
      hebrew: 'הבית שלנו מלא במשפחה וחברים.',
      english: 'Our home is full of family and friends.',
      pattern: 'Our home is full of family and friends.',
      theme: 'At Home',
      difficulty: 2,
      grammarPoints: ['possession', 'adjectives']
    }),

    // Pair 2: We are at home
    createSentence({
      id: 'home-2-short',
      hebrew: 'אנחנו בבית.',
      english: 'We are at home.',
      pattern: "{We are, We're} at home.",
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['location', 'simple present']
    }),
    createSentence({
      id: 'home-2',
      hebrew: 'אנחנו אוהבים לשבת בבית ולדבר.',
      english: 'We like to sit at home and talk.',
      pattern: 'We like to sit at home and talk.',
      theme: 'At Home',
      difficulty: 2,
      grammarPoints: ['verb + infinitive', 'prepositions']
    }),

    // Pair 3: I need a home
    createSentence({
      id: 'home-3-short',
      hebrew: 'אני צריך בית.',
      english: 'I need a home.',
      pattern: 'I need a home.',
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['need statements']
    }),
    createSentence({
      id: 'home-3',
      hebrew: 'אני צריך בית שקט בערב.',
      english: 'I need a quiet home in the evening.',
      pattern: 'I need a quiet home in the evening.',
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['need statements', 'adjectives']
    }),

    // Pair 4: Neighbor helps us
    createSentence({
      id: 'home-4-short',
      hebrew: 'שכן עוזר לנו.',
      english: 'A neighbor helps us.',
      pattern: '{A, The} neighbor helps us.',
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['present tense']
    }),
    createSentence({
      id: 'home-4',
      hebrew: 'שכן עוזר לנו כל יום בבית.',
      english: 'A neighbor helps us every day at home.',
      pattern: '{A, The} neighbor helps us every day at home.',
      theme: 'At Home',
      difficulty: 2,
      grammarPoints: ['present tense', 'frequency adverb']
    }),

    // Pair 5: We study together
    createSentence({
      id: 'home-5-short',
      hebrew: 'אנחנו לומדים יחד.',
      english: 'We study together.',
      pattern: 'We study together.',
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['plural subject', 'present tense']
    }),
    createSentence({
      id: 'home-5',
      hebrew: 'היום אנחנו לומדים בבית יחד.',
      english: 'Today we study at home together.',
      pattern: 'Today we study at home together.',
      theme: 'At Home',
      difficulty: 2,
      grammarPoints: ['time adverb', 'location preposition']
    }),

    // Pair 6: I have an idea
    createSentence({
      id: 'home-6-short',
      hebrew: 'יש לי רעיון.',
      english: 'I have an idea.',
      pattern: 'I have an idea.',
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['possession']
    }),
    createSentence({
      id: 'home-6',
      hebrew: 'יש לי רעיון קטן לבית שלנו.',
      english: 'I have a small idea for our home.',
      pattern: 'I have a small idea for our home.',
      theme: 'At Home',
      difficulty: 3,
      grammarPoints: ['possession', 'infinitive purpose']
    }),

    // Pair 7: Child reads book
    createSentence({
      id: 'home-7-short',
      hebrew: 'הילד קורא ספר.',
      english: 'The child reads a book.',
      pattern: 'The child reads a book.',
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['present tense']
    }),
    createSentence({
      id: 'home-7',
      hebrew: 'הילד קורא ספר בחדר שלו.',
      english: 'The child reads a book in his room.',
      pattern: 'The child reads a book in his room.',
      theme: 'At Home',
      difficulty: 2,
      grammarPoints: ['present tense', 'location phrases']
    }),

    // Pair 8: We have water
    createSentence({
      id: 'home-8-short',
      hebrew: 'יש לנו מים.',
      english: 'We have water.',
      pattern: 'We have water.',
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['possession']
    }),
    createSentence({
      id: 'home-8',
      hebrew: 'יש לנו מים וקפה במטבח.',
      english: 'We have water and coffee in the kitchen.',
      pattern: 'We have water and coffee in the kitchen.',
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['possession', 'conjunctions']
    }),

    // Pair 9: I want coffee
    createSentence({
      id: 'home-9-short',
      hebrew: 'אני רוצה קפה.',
      english: 'I want coffee.',
      pattern: 'I want coffee.',
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['want statements']
    }),
    createSentence({
      id: 'home-9',
      hebrew: 'אני רוצה זמן שקט בבוקר עם קפה.',
      english: 'I want a quiet time in the morning with coffee.',
      pattern: 'I want a quiet time in the morning with coffee.',
      theme: 'At Home',
      difficulty: 2,
      grammarPoints: ['time phrases', 'adjectives']
    }),

    // Pair 10: Friend lives nearby
    createSentence({
      id: 'home-10-short',
      hebrew: 'החבר גר ליד.',
      english: 'The friend lives nearby.',
      pattern: 'The friend lives nearby.',
      theme: 'At Home',
      difficulty: 1,
      grammarPoints: ['present tense', 'location']
    }),
    createSentence({
      id: 'home-10',
      hebrew: 'החבר גר ליד הבית שלנו',
      english: 'The friend lives near our home.',
      pattern: 'The friend lives near our home.',
      theme: 'At Home',
      difficulty: 3,
      grammarPoints: ['location prepositions', 'possession']
    })
  ],
  'Food & Eating': [
    // Pair 1: I want to eat
    createSentence({
      id: 'food-1-short',
      hebrew: 'אני רוצה לאכול.',
      english: 'I want to eat.',
      pattern: 'I want to eat.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['verb + infinitive']
    }),
    createSentence({
      id: 'food-1',
      hebrew: 'אני רוצה לאכול אוכל חם עכשיו.',
      english: 'I want to eat warm food right now.',
      pattern: 'I want to eat warm food right now.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['verb + infinitive', 'adjectives']
    }),

    // Pair 2: We drink water
    createSentence({
      id: 'food-2-short',
      hebrew: 'אנחנו שותים מים.',
      english: 'We drink water.',
      pattern: 'We drink water.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['plural subject', 'present tense']
    }),
    createSentence({
      id: 'food-2',
      hebrew: 'אנחנו שותים מים קרים יחד.',
      english: 'We drink cold water together.',
      pattern: 'We drink cold water together.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['plural subject', 'adjectives']
    }),

    // Pair 3: She drinks coffee
    createSentence({
      id: 'food-3-short',
      hebrew: 'היא שותה קפה.',
      english: 'She drinks coffee.',
      pattern: 'She drinks coffee.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['present tense']
    }),
    createSentence({
      id: 'food-3',
      hebrew: 'היא אוהבת לשתות קפה בבוקר',
      english: 'She loves to drink coffee in the morning.',
      pattern: 'She loves to drink coffee in the morning.',
      theme: 'Food & Eating',
      difficulty: 2,
      grammarPoints: ['verb + infinitive', 'time phrases']
    }),

    // Pair 4: Food is very tasty
    createSentence({
      id: 'food-4-short',
      hebrew: 'האוכל טעים מאוד.',
      english: 'The food is very tasty.',
      pattern: 'The food is very tasty.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['copula', 'intensifiers']
    }),
    createSentence({
      id: 'food-4',
      hebrew: 'האוכל במסעדה טעים מאוד.',
      english: 'The food at the restaurant is very tasty.',
      pattern: 'The food at the restaurant is very tasty.',
      theme: 'Food & Eating',
      difficulty: 3,
      grammarPoints: ['copula', 'intensifiers']
    }),

    // Pair 5: We buy bread
    createSentence({
      id: 'food-5-short',
      hebrew: 'אנחנו קונים לחם.',
      english: 'We are buying bread.',
      pattern: "{We are buying, We're buying, We buy} bread.",
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['present tense']
    }),
    createSentence({
      id: 'food-5',
      hebrew: 'אנחנו קונים לחם טרי היום.',
      english: 'We are buying fresh bread today.',
      pattern: "{We are buying, We're buying, We buy} fresh bread today.",
      theme: 'Food & Eating',
      difficulty: 2,
      grammarPoints: ['present progressive', 'adjectives']
    }),

    // Pair 6: I pay for food
    createSentence({
      id: 'food-6-short',
      hebrew: 'אני משלם על אוכל.',
      english: 'I pay for food.',
      pattern: 'I pay for food.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['prepositions']
    }),
    createSentence({
      id: 'food-6',
      hebrew: 'אני משלם על אוכל ושותה מים',
      english: 'I pay for food and drink water.',
      pattern: 'I pay for food and drink water.',
      theme: 'Food & Eating',
      difficulty: 3,
      grammarPoints: ['prepositions', 'coordinating verbs']
    }),

    // Pair 7: He cooks at home
    createSentence({
      id: 'food-7-short',
      hebrew: 'הוא מבשל בבית.',
      english: 'He cooks at home.',
      pattern: 'He cooks at home.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['present tense', 'location']
    }),
    createSentence({
      id: 'food-7',
      hebrew: 'הוא מבשל בבית עם המשפחה.',
      english: 'He cooks at home with the family.',
      pattern: 'He cooks at home with the family.',
      theme: 'Food & Eating',
      difficulty: 2,
      grammarPoints: ['location phrases', 'prepositions']
    }),

    // Pair 8: I want water
    createSentence({
      id: 'food-8-short',
      hebrew: 'אני רוצה מים.',
      english: 'I want water.',
      pattern: 'I want water.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['want statements']
    }),
    createSentence({
      id: 'food-8',
      hebrew: 'אני רוצה עוד מים בבקשה',
      english: 'I want more water, please.',
      pattern: 'I want more water, please.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['politeness', 'quantifiers']
    }),

    // Pair 9: They order coffee
    createSentence({
      id: 'food-9-short',
      hebrew: 'הם מזמינים קפה.',
      english: 'They order coffee.',
      pattern: 'They order coffee.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['present tense']
    }),
    createSentence({
      id: 'food-9',
      hebrew: 'הם מזמינים קפה נוסף כל ערב.',
      english: 'They order another coffee every evening.',
      pattern: 'They order another coffee every evening.',
      theme: 'Food & Eating',
      difficulty: 3,
      grammarPoints: ['present tense', 'quantifiers']
    }),

    // Pair 10: We have an idea
    createSentence({
      id: 'food-10-short',
      hebrew: 'יש לנו רעיון.',
      english: 'We have an idea.',
      pattern: 'We have an idea.',
      theme: 'Food & Eating',
      difficulty: 1,
      grammarPoints: ['possession']
    }),
    createSentence({
      id: 'food-10',
      hebrew: 'יש לנו רעיון לארוחת ערב',
      english: 'We have an idea for dinner.',
      pattern: 'We have an idea for dinner.',
      theme: 'Food & Eating',
      difficulty: 2,
      grammarPoints: ['possession', 'purpose phrase']
    })
  ],
  'Numbers & Time': [
    // Pair 1: Today is good
    createSentence({
      id: 'time-1-short',
      hebrew: 'היום יום טוב.',
      english: 'Today is a good day.',
      pattern: 'Today is a good day.',
      theme: 'Numbers & Time',
      difficulty: 1,
      grammarPoints: ['copula', 'time reference']
    }),
    createSentence({
      id: 'time-1',
      hebrew: 'היום יום טוב ושקט.',
      english: 'Today is a good and quiet day.',
      pattern: 'Today is a good and quiet day.',
      theme: 'Numbers & Time',
      difficulty: 1,
      grammarPoints: ['copula', 'adjectives']
    }),

    // Pair 2: Tomorrow we are coming
    createSentence({
      id: 'time-2-short',
      hebrew: 'מחר אנחנו באים.',
      english: 'Tomorrow we are coming.',
      pattern: 'Tomorrow we are coming.',
      theme: 'Numbers & Time',
      difficulty: 1,
      grammarPoints: ['future reference', 'motion verb']
    }),
    createSentence({
      id: 'time-2',
      hebrew: 'מחר אנחנו באים לעיר מוקדם.',
      english: 'Tomorrow we are coming to the city early.',
      pattern: 'Tomorrow we are coming to the city early.',
      theme: 'Numbers & Time',
      difficulty: 2,
      grammarPoints: ['future reference', 'motion verb']
    }),

    // Pair 3: Yesterday we waited
    createSentence({
      id: 'time-3-short',
      hebrew: 'אתמול חיכינו הרבה.',
      english: 'Yesterday we waited a lot.',
      pattern: 'Yesterday we waited a lot.',
      theme: 'Numbers & Time',
      difficulty: 1,
      grammarPoints: ['past reference']
    }),
    createSentence({
      id: 'time-3',
      hebrew: 'אתמול חיכינו הרבה זמן בתחנה.',
      english: 'Yesterday we waited a long time at the station.',
      pattern: 'Yesterday we waited a long time at the station.',
      theme: 'Numbers & Time',
      difficulty: 2,
      grammarPoints: ['past reference', 'time duration']
    }),

    // Pair 4: Now I am going
    createSentence({
      id: 'time-4-short',
      hebrew: 'עכשיו אני הולך.',
      english: 'Now I am going.',
      pattern: 'Now I am going.',
      theme: 'Numbers & Time',
      difficulty: 1,
      grammarPoints: ['present progressive', 'time reference']
    }),
    createSentence({
      id: 'time-4',
      hebrew: 'עכשיו אני הולך לבית כדי לנוח.',
      english: 'Now I am going home to rest.',
      pattern: 'Now I am going home to rest.',
      theme: 'Numbers & Time',
      difficulty: 2,
      grammarPoints: ['present progressive', 'direction']
    }),

    // Pair 5: We arrive early
    createSentence({
      id: 'time-5-short',
      hebrew: 'אנחנו מגיעים מוקדם.',
      english: 'We arrive early.',
      pattern: 'We arrive early.',
      theme: 'Numbers & Time',
      difficulty: 1,
      grammarPoints: ['motion verbs', 'time adverb']
    }),
    createSentence({
      id: 'time-5',
      hebrew: 'אנחנו מגיעים מוקדם בבוקר לפגישה.',
      english: 'We arrive early in the morning for a meeting.',
      pattern: 'We arrive early in the morning for a meeting.',
      theme: 'Numbers & Time',
      difficulty: 2,
      grammarPoints: ['time phrases', 'motion verbs']
    }),

    // Pair 6: Meeting starts now
    createSentence({
      id: 'time-6-short',
      hebrew: 'הפגישה מתחילה עכשיו.',
      english: 'The meeting starts now.',
      pattern: 'The meeting starts now.',
      theme: 'Numbers & Time',
      difficulty: 1,
      grammarPoints: ['present tense', 'time reference']
    }),
    createSentence({
      id: 'time-6',
      hebrew: 'הפגישה מתחילה בשעה חמש',
      english: 'The meeting starts at five o\'clock.',
      pattern: "The meeting starts at five o'clock.",
      theme: 'Numbers & Time',
      difficulty: 3,
      grammarPoints: ['clock time', 'present tense']
    }),

    // Pair 7: We finish late
    createSentence({
      id: 'time-7-short',
      hebrew: 'אנחנו מסיימים מאוחר.',
      english: 'We finish late.',
      pattern: 'We finish late.',
      theme: 'Numbers & Time',
      difficulty: 1,
      grammarPoints: ['present tense', 'time adverb']
    }),
    createSentence({
      id: 'time-7',
      hebrew: 'אנחנו מסיימים מאוחר בערב אחרי הספר.',
      english: 'We finish late in the evening after the book.',
      pattern: 'We finish late in the evening after the book.',
      theme: 'Numbers & Time',
      difficulty: 2,
      grammarPoints: ['time phrases', 'adverbs']
    }),

    // Pair 8: I wait ten minutes
    createSentence({
      id: 'time-8-short',
      hebrew: 'אני מחכה עשר דקות.',
      english: 'I wait ten minutes.',
      pattern: 'I wait ten minutes.',
      theme: 'Numbers & Time',
      difficulty: 1,
      grammarPoints: ['numbers', 'time duration']
    }),
    createSentence({
      id: 'time-8',
      hebrew: 'אני מחכה עשר דקות ואתה בא',
      english: 'I wait ten minutes and you come.',
      pattern: 'I wait ten minutes and you come.',
      theme: 'Numbers & Time',
      difficulty: 3,
      grammarPoints: ['numbers', 'coordinated clauses']
    }),

    // Pair 9: Time is short
    createSentence({
      id: 'time-9-short',
      hebrew: 'לפעמים הזמן קצר.',
      english: 'Sometimes time is short.',
      pattern: 'Sometimes time is short.',
      theme: 'Numbers & Time',
      difficulty: 1,
      grammarPoints: ['frequency adverb', 'copula']
    }),
    createSentence({
      id: 'time-9',
      hebrew: 'לפעמים הזמן קצר מדי לקרוא ספר.',
      english: 'Sometimes time is too short to read a book.',
      pattern: 'Sometimes time is too short to read a book.',
      theme: 'Numbers & Time',
      difficulty: 2,
      grammarPoints: ['frequency adverb', 'adjectives']
    }),

    // Pair 10: We always have an hour
    createSentence({
      id: 'time-10-short',
      hebrew: 'תמיד יש לנו שעה.',
      english: 'We always have an hour.',
      pattern: 'We always have an hour.',
      theme: 'Numbers & Time',
      difficulty: 1,
      grammarPoints: ['frequency adverb', 'possession']
    }),
    createSentence({
      id: 'time-10',
      hebrew: 'תמיד יש לנו שעה לקרוא ספר יחד.',
      english: 'We always have an hour to read a book together.',
      pattern: 'We always have an hour to read a book together.',
      theme: 'Numbers & Time',
      difficulty: 3,
      grammarPoints: ['frequency adverb', 'infinitive purpose']
    })
  ]
};

export const allSentences: Sentence[] = Object.values(sentencesByTheme).flat();
