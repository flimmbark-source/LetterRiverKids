import { loadLanguage } from './languageLoader.js';
import { getAssociation } from '../data/soundAssociations.js';

export function getLetterPool(languageId = 'he', appLanguageId = 'en') {
  const languagePack = loadLanguage(languageId);
  return (languagePack.items ?? []).map((item) => {
    const association = getAssociation(item.sound, appLanguageId);
    return {
      ...item,
      association
    };
  });
}

export function pickUniqueOptions(target, pool, size = 3) {
  const distractors = pool.filter((item) => item.id !== target.id);
  const shuffled = [...distractors].sort(() => Math.random() - 0.5);
  const options = [target, ...shuffled.slice(0, Math.max(0, size - 1))];
  return options.sort(() => Math.random() - 0.5);
}

export function normalizeAccuracy(stats = {}) {
  const correct = stats.correct ?? 0;
  const attempts = stats.attempts ?? 0;
  if (!attempts) return 0;
  return correct / attempts;
}
