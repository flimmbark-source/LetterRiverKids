import { loadLanguage } from './languageLoader.js';
import { getAssociation } from '../data/soundAssociations.js';

function toKidLetter(item, appLanguageId = 'en') {
  const phoneticSeed = item.sound ?? item.pronunciation ?? item.name ?? item.symbol;
  const phonetic = String(phoneticSeed || '').trim();
  const association = getAssociation(phonetic, appLanguageId);

  return {
    id: item.id,
    symbol: item.symbol,
    name: item.name ?? item.symbol,
    phonetic,
    transliteration: item.transliteration ?? item.name ?? item.symbol,
    association: association
      ? {
          emoji: association.emoji,
          word: association.word,
          alt: association.alt
        }
      : null
  };
}

export function getLettersForLanguage(languagePack = loadLanguage(), appLanguageId = 'en') {
  const items = Array.isArray(languagePack?.allItems) && languagePack.allItems.length
    ? languagePack.allItems
    : Array.isArray(languagePack?.items)
      ? languagePack.items
      : Array.isArray(languagePack?.consonants)
        ? languagePack.consonants
        : [];

  return items.map((item) => toKidLetter(item, appLanguageId));
}

export function getKidLetterChoices(letters, targetLetter, count = 3) {
  if (!Array.isArray(letters) || !targetLetter) {
    return [];
  }

  const unique = new Map();
  letters.forEach((letter) => {
    if (letter?.id) {
      unique.set(letter.id, letter);
    }
  });

  const pool = Array.from(unique.values()).filter((letter) => letter.id !== targetLetter.id);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return [targetLetter, ...shuffled.slice(0, Math.max(0, count - 1))].sort(() => Math.random() - 0.5);
}
