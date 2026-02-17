/**
 * Tests for pattern matching utility
 */

import { describe, it, expect } from 'vitest';
import { matchesPattern, getCanonicalFromPattern } from './patternMatcher.js';

describe('matchesPattern', () => {
  describe('simple alternatives', () => {
    const pattern = "{Hi, Hello}, {I'm, I am} Dani.";

    it('matches first alternative in each group', () => {
      expect(matchesPattern("Hi, I'm Dani.", pattern)).toBe(true);
    });

    it('matches second alternative in each group', () => {
      expect(matchesPattern("Hello, I am Dani.", pattern)).toBe(true);
    });

    it('matches mixed alternatives', () => {
      expect(matchesPattern("Hi, I am Dani.", pattern)).toBe(true);
      expect(matchesPattern("Hello, I'm Dani.", pattern)).toBe(true);
    });

    it('does not match unknown alternatives', () => {
      expect(matchesPattern("Hey, I'm Dani.", pattern)).toBe(false);
    });
  });

  describe('complex multi-group pattern', () => {
    const pattern = "{Hi, Hello}, {I'm, I am} Dani, {nice to meet you, nice meeting you, it's nice to meet you}.";

    it('matches first alternatives', () => {
      expect(matchesPattern("Hi, I'm Dani, nice to meet you.", pattern)).toBe(true);
    });

    it('matches second alternatives', () => {
      expect(matchesPattern("Hello, I am Dani, nice meeting you.", pattern)).toBe(true);
    });

    it('matches third alternative in last group', () => {
      expect(matchesPattern("Hi, I'm Dani, it's nice to meet you.", pattern)).toBe(true);
    });

    it('matches cross-combination of alternatives', () => {
      expect(matchesPattern("Hello, I am Dani, nice to meet you.", pattern)).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    const pattern = "{Hi, Hello} there";

    it('matches lowercase input', () => {
      expect(matchesPattern("hi there", pattern)).toBe(true);
    });

    it('matches uppercase input', () => {
      expect(matchesPattern("HELLO THERE", pattern)).toBe(true);
    });

    it('matches mixed case input', () => {
      expect(matchesPattern("Hi There", pattern)).toBe(true);
    });
  });

  describe('whitespace and punctuation handling', () => {
    const pattern = "{Hi, Hello}, {I'm, I am} Dani.";

    it('tolerates extra whitespace', () => {
      expect(matchesPattern("Hi,  I'm   Dani.", pattern)).toBe(true);
    });

    it('matches without trailing period', () => {
      expect(matchesPattern("Hi, I'm Dani", pattern)).toBe(true);
    });

    it('matches without comma', () => {
      expect(matchesPattern("Hi I'm Dani", pattern)).toBe(true);
    });

    it('matches without any punctuation', () => {
      expect(matchesPattern("Hi Im Dani", pattern)).toBe(true);
    });
  });

  describe('question mark patterns', () => {
    const pattern = "{Where are you from, Where do you come from}? {I am, I'm} new in the city.";

    it('matches first question alternative', () => {
      expect(matchesPattern("Where are you from? I am new in the city.", pattern)).toBe(true);
    });

    it('matches second question alternative', () => {
      expect(matchesPattern("Where do you come from? I'm new in the city.", pattern)).toBe(true);
    });
  });

  describe('user input edge cases', () => {
    const pattern = "{Hi, Hello}, {I'm, I am} Dani, {nice to meet you, nice meeting you, it's nice to meet you}.";

    it('matches input starting with lowercase and missing some punctuation', () => {
      expect(matchesPattern("hello I'm Dani, nice to meet you", pattern)).toBe(true);
    });

    it('matches input with no punctuation at all', () => {
      expect(matchesPattern("hello Im Dani nice to meet you", pattern)).toBe(true);
    });
  });
});

describe('getCanonicalFromPattern', () => {
  it('returns the first alternative from each group', () => {
    const pattern = "{Hi, Hello}, {I'm, I am} Dani.";
    expect(getCanonicalFromPattern(pattern)).toBe("Hi, I'm Dani.");
  });

  it('returns first alternative from complex pattern', () => {
    const pattern = "{Hi, Hello}, {I'm, I am} Dani, {nice to meet you, nice meeting you, it's nice to meet you}.";
    expect(getCanonicalFromPattern(pattern)).toBe("Hi, I'm Dani, nice to meet you.");
  });
});
