/**
 * Pattern matching utility for flexible sentence grading
 *
 * Pattern syntax:
 * - {option1, option2, option3} - Any one of the options (alternatives)
 * - Plain text - Must match exactly (case-insensitive)
 *
 * Example: "{Hi, Hello} {I'm, I am} Dani, {nice, it's nice} {to meet, meeting} you"
 *
 * This would match:
 * - "Hi I'm Dani, nice to meet you"
 * - "Hello I am Dani, it's nice meeting you"
 * - etc.
 */

/**
 * Parse a pattern string into tokens
 * @param {string} pattern - Pattern string with {alternatives}
 * @returns {Array} Array of tokens, each either a string or an array of alternatives
 */
function parsePattern(pattern) {
  const tokens = [];
  let currentPos = 0;

  while (currentPos < pattern.length) {
    // Look for opening brace
    const braceStart = pattern.indexOf('{', currentPos);

    if (braceStart === -1) {
      // No more braces, rest is plain text
      const remaining = pattern.slice(currentPos).trim();
      if (remaining) {
        tokens.push(remaining);
      }
      break;
    }

    // Add plain text before the brace
    if (braceStart > currentPos) {
      const plainText = pattern.slice(currentPos, braceStart).trim();
      if (plainText) {
        tokens.push(plainText);
      }
    }

    // Find matching closing brace
    const braceEnd = pattern.indexOf('}', braceStart);
    if (braceEnd === -1) {
      // Malformed pattern, treat rest as plain text
      const remaining = pattern.slice(currentPos).trim();
      if (remaining) {
        tokens.push(remaining);
      }
      break;
    }

    // Extract alternatives
    const alternativesText = pattern.slice(braceStart + 1, braceEnd);
    const alternatives = alternativesText.split(',').map(alt => alt.trim()).filter(alt => alt);

    if (alternatives.length > 0) {
      tokens.push(alternatives);
    }

    currentPos = braceEnd + 1;
  }

  return tokens;
}

/**
 * Generate all possible sentences from a pattern
 * @param {Array} tokens - Array of tokens from parsePattern
 * @param {number} index - Current token index
 * @param {string} current - Current sentence being built
 * @returns {Array<string>} All possible sentences
 */
function generateVariants(tokens, index = 0, current = '') {
  if (index >= tokens.length) {
    return [current.trim()];
  }

  const token = tokens[index];
  const results = [];

  // Don't add a space before punctuation characters
  const needsSpaceBefore = (str) => str && !/^[.,!?;:]/.test(str);

  if (Array.isArray(token)) {
    // Token is alternatives - generate a variant for each
    for (const alternative of token) {
      const prefix = current && needsSpaceBefore(alternative)
        ? `${current} ${alternative}`
        : `${current}${alternative}`;
      const variants = generateVariants(tokens, index + 1, prefix);
      results.push(...variants);
    }
  } else {
    // Token is plain text
    const prefix = current && needsSpaceBefore(token)
      ? `${current} ${token}`
      : `${current}${token}`;
    const variants = generateVariants(tokens, index + 1, prefix);
    results.push(...variants);
  }

  return results;
}

/**
 * Normalize a sentence for comparison
 * - Convert to lowercase
 * - Remove all punctuation (to make it optional)
 * - Remove extra whitespace
 */
function normalizeSentence(sentence) {
  return sentence
    .toLowerCase()
    .trim()
    // Remove all punctuation for lenient comparison
    .replace(/[.,!?;:'"-]/g, '')
    // Normalize multiple spaces to single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if user input matches a pattern
 * @param {string} userInput - User's typed sentence
 * @param {string} pattern - Pattern string with {alternatives}
 * @returns {boolean} True if matches any valid variant
 */
export function matchesPattern(userInput, pattern) {
  if (!pattern || !userInput) {
    return false;
  }

  // Parse the pattern and generate all valid variants
  const tokens = parsePattern(pattern);
  const validVariants = generateVariants(tokens);

  // Normalize user input
  const normalizedInput = normalizeSentence(userInput);

  // Check if user input matches any valid variant
  return validVariants.some(variant => {
    const normalizedVariant = normalizeSentence(variant);
    return normalizedInput === normalizedVariant;
  });
}

/**
 * Get the canonical (first) sentence from a pattern
 * @param {string} pattern - Pattern string
 * @returns {string} First valid sentence variant
 */
export function getCanonicalFromPattern(pattern) {
  if (!pattern) {
    return '';
  }

  const tokens = parsePattern(pattern);
  const variants = generateVariants(tokens);
  return variants[0] || '';
}
