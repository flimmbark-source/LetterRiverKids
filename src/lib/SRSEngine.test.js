/**
 * Unit tests for SRS Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SRSEngine, GRADE, MATURITY, createDefaultEngine } from './SRSEngine.js';

describe('SRSEngine', () => {
  let engine;
  let mockItem;

  beforeEach(() => {
    engine = new SRSEngine();
    mockItem = {
      itemId: 'test-letter',
      itemType: 'letter',
      easeFactor: 2.5,
      interval: 0,
      dueDate: Date.now(),
      reviewCount: 0,
      lapseCount: 0,
      lastReviewDate: 0,
      recentGrades: []
    };
  });

  describe('calculateEaseFactor', () => {
    it('should calculate ease factor using SM-2 formula', () => {
      // For grade 5 (perfect): EF' = 2.5 + (0.1 - 0 * (0.08 + 0)) = 2.6
      expect(engine.calculateEaseFactor(2.5, 5)).toBe(2.6);

      // For grade 4: EF' = 2.5 + (0.1 - 1 * (0.08 + 0.02)) = 2.5 + (0.1 - 0.1) = 2.5
      expect(engine.calculateEaseFactor(2.5, 4)).toBe(2.5);

      // For grade 3: EF' = 2.5 + (0.1 - 2 * (0.08 + 2*0.02)) = 2.5 + (0.1 - 0.24) = 2.36
      expect(engine.calculateEaseFactor(2.5, 3)).toBeCloseTo(2.36, 2);

      // For grade 2: EF' = 2.5 + (0.1 - 3 * (0.08 + 3*0.02)) = 2.5 + (0.1 - 0.42) = 2.18
      expect(engine.calculateEaseFactor(2.5, 2)).toBeCloseTo(2.18, 2);

      // For grade 0: EF' = 2.5 + (0.1 - 5 * (0.08 + 5*0.02)) = 2.5 + (0.1 - 0.90) = 1.70 (above min, not clamped)
      expect(engine.calculateEaseFactor(2.5, 0)).toBeCloseTo(1.7, 2);
    });

    it('should enforce minimum ease factor of 1.3', () => {
      // Multiple failures should not go below 1.3
      let ef = 2.5;
      ef = engine.calculateEaseFactor(ef, 0);
      expect(ef).toBeGreaterThanOrEqual(1.3);

      ef = engine.calculateEaseFactor(ef, 0);
      expect(ef).toBeGreaterThanOrEqual(1.3);
    });

    it('should throw error for invalid grades', () => {
      expect(() => engine.calculateEaseFactor(2.5, -1)).toThrow();
      expect(() => engine.calculateEaseFactor(2.5, 6)).toThrow();
      expect(() => engine.calculateEaseFactor(2.5, 10)).toThrow();
    });

    it('should handle custom minimum ease factor', () => {
      const customEngine = new SRSEngine({ minEaseFactor: 1.5 });
      const ef = customEngine.calculateEaseFactor(1.6, 0);
      expect(ef).toBeGreaterThanOrEqual(1.5);
    });
  });

  describe('calculateInterval', () => {
    it('should return 0 for failed reviews (grade < 3)', () => {
      expect(engine.calculateInterval(mockItem, 0)).toBe(0);
      expect(engine.calculateInterval(mockItem, 1)).toBe(0);
      expect(engine.calculateInterval(mockItem, 2)).toBe(0);
    });

    it('should return 1 day for first successful review', () => {
      expect(engine.calculateInterval(mockItem, 3)).toBe(1);
      expect(engine.calculateInterval(mockItem, 4)).toBe(1);
      expect(engine.calculateInterval(mockItem, 5)).toBe(1);
    });

    it('should return 6 days for second successful review', () => {
      const item = { ...mockItem, interval: 1, reviewCount: 1 };
      expect(engine.calculateInterval(item, 3)).toBe(Math.round(1 * 1.2)); // Hard response
      expect(engine.calculateInterval(item, 4)).toBe(6);
      expect(engine.calculateInterval(item, 5)).toBe(6);
    });

    it('should apply ease factor for subsequent reviews', () => {
      const item = { ...mockItem, interval: 6, easeFactor: 2.5, reviewCount: 2 };

      // Good response: 6 * 2.5 = 15
      expect(engine.calculateInterval(item, 4)).toBe(15);
    });

    it('should apply easy bonus for grade 5', () => {
      const item = { ...mockItem, interval: 6, easeFactor: 2.5, reviewCount: 2 };

      // Easy response: 6 * 2.5 * 1.3 = 19.5 -> 20
      const result = engine.calculateInterval(item, 5);
      expect(result).toBe(Math.round(6 * 2.5 * 1.3));
    });

    it('should apply hard interval multiplier for grade 3 on mature items', () => {
      const item = { ...mockItem, interval: 10, easeFactor: 2.5, reviewCount: 3 };

      // Hard response: 10 * 1.2 = 12
      expect(engine.calculateInterval(item, 3)).toBe(12);
    });

    it('should reset interval to 0 after lapse', () => {
      const item = { ...mockItem, interval: 30, easeFactor: 2.5, reviewCount: 5 };

      // Failed review should reset
      expect(engine.calculateInterval(item, 2)).toBe(0);
      expect(engine.calculateInterval(item, 1)).toBe(0);
      expect(engine.calculateInterval(item, 0)).toBe(0);
    });
  });

  describe('processReview', () => {
    it('should update all item properties after review', () => {
      const timestamp = Date.now();
      const result = engine.processReview(mockItem, 4, timestamp);

      expect(result.easeFactor).toBe(2.5); // Grade 4 maintains EF
      expect(result.interval).toBe(1); // First review
      expect(result.reviewCount).toBe(1);
      expect(result.lapseCount).toBe(0);
      expect(result.lastReviewDate).toBe(timestamp);
      expect(result.dueDate).toBeGreaterThan(timestamp);
      expect(result.recentGrades).toEqual([4]);
    });

    it('should increment lapse count on failure', () => {
      const result = engine.processReview(mockItem, 2);

      expect(result.lapseCount).toBe(1);
      expect(result.interval).toBe(0);
    });

    it('should track recent grades (max 10)', () => {
      let item = { ...mockItem };

      // Add 12 reviews
      for (let i = 0; i < 12; i++) {
        item = engine.processReview(item, 4);
      }

      expect(item.recentGrades.length).toBe(10);
      expect(item.recentGrades.every(g => g === 4)).toBe(true);
    });

    it('should calculate due date correctly', () => {
      const timestamp = Date.now();
      const result = engine.processReview(mockItem, 4, timestamp);

      // First review: 1 day = 86400000 ms
      const expectedDueDate = timestamp + (1 * 24 * 60 * 60 * 1000);
      expect(result.dueDate).toBe(expectedDueDate);
    });

    it('should preserve other item properties', () => {
      const itemWithExtra = {
        ...mockItem,
        itemId: 'aleph',
        metadata: { example: 'test' }
      };

      const result = engine.processReview(itemWithExtra, 4);

      expect(result.itemId).toBe('aleph');
      expect(result.metadata).toEqual({ example: 'test' });
    });

    it('should throw error if item is missing', () => {
      expect(() => engine.processReview(null, 4)).toThrow();
      expect(() => engine.processReview(undefined, 4)).toThrow();
    });
  });

  describe('getMaturity', () => {
    it('should return NEW for unreviewed items', () => {
      expect(engine.getMaturity(mockItem)).toBe(MATURITY.NEW);
    });

    it('should return NEW for items with interval 0', () => {
      const item = { ...mockItem, reviewCount: 1, interval: 0 };
      expect(engine.getMaturity(item)).toBe(MATURITY.NEW);
    });

    it('should return LEARNING for interval < 21 days', () => {
      const item = { ...mockItem, reviewCount: 1, interval: 1 };
      expect(engine.getMaturity(item)).toBe(MATURITY.LEARNING);

      const item2 = { ...mockItem, reviewCount: 2, interval: 20 };
      expect(engine.getMaturity(item2)).toBe(MATURITY.LEARNING);
    });

    it('should return YOUNG for 21 <= interval < 100 days', () => {
      const item = { ...mockItem, reviewCount: 3, interval: 21 };
      expect(engine.getMaturity(item)).toBe(MATURITY.YOUNG);

      const item2 = { ...mockItem, reviewCount: 4, interval: 99 };
      expect(engine.getMaturity(item2)).toBe(MATURITY.YOUNG);
    });

    it('should return MATURE for interval >= 100 days', () => {
      const item = { ...mockItem, reviewCount: 5, interval: 100 };
      expect(engine.getMaturity(item)).toBe(MATURITY.MATURE);

      const item2 = { ...mockItem, reviewCount: 6, interval: 365 };
      expect(engine.getMaturity(item2)).toBe(MATURITY.MATURE);
    });
  });

  describe('calculatePriority', () => {
    const now = Date.now();

    it('should give higher priority to overdue items', () => {
      const onTime = { ...mockItem, itemType: 'letter', dueDate: now };
      const overdue1Day = { ...mockItem, itemType: 'letter', dueDate: now - 24 * 60 * 60 * 1000 };
      const overdue3Days = { ...mockItem, itemType: 'letter', dueDate: now - 3 * 24 * 60 * 60 * 1000 };

      expect(engine.calculatePriority(overdue3Days, now)).toBeGreaterThan(
        engine.calculatePriority(overdue1Day, now)
      );
      expect(engine.calculatePriority(overdue1Day, now)).toBeGreaterThan(
        engine.calculatePriority(onTime, now)
      );
    });

    it('should prioritize by item type (letter > vocabulary > grammar)', () => {
      const letter = { ...mockItem, itemType: 'letter', dueDate: now };
      const vocab = { ...mockItem, itemType: 'vocabulary', dueDate: now };
      const grammar = { ...mockItem, itemType: 'grammar', dueDate: now };

      expect(engine.calculatePriority(letter, now)).toBeGreaterThan(
        engine.calculatePriority(vocab, now)
      );
      expect(engine.calculatePriority(vocab, now)).toBeGreaterThan(
        engine.calculatePriority(grammar, now)
      );
    });

    it('should prioritize learning items', () => {
      const newItem = { ...mockItem, reviewCount: 0, interval: 0, itemType: 'letter', dueDate: now };
      const learning = { ...mockItem, reviewCount: 1, interval: 5, itemType: 'letter', dueDate: now };
      const mature = { ...mockItem, reviewCount: 10, interval: 100, itemType: 'letter', dueDate: now };

      expect(engine.calculatePriority(learning, now)).toBeGreaterThan(
        engine.calculatePriority(mature, now)
      );
    });
  });

  describe('getDailyQueue', () => {
    let items;

    beforeEach(() => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      items = [
        // Due items
        { ...mockItem, itemId: '1', itemType: 'grammar', reviewCount: 1, interval: 1, dueDate: now - dayMs }, // Overdue
        { ...mockItem, itemId: '2', itemType: 'letter', reviewCount: 1, interval: 1, dueDate: now - 0.5 * dayMs }, // Due today
        { ...mockItem, itemId: '3', itemType: 'vocabulary', reviewCount: 1, interval: 1, dueDate: now - 2 * dayMs }, // Very overdue
        { ...mockItem, itemId: '4', itemType: 'grammar', reviewCount: 1, interval: 1, dueDate: now },
        // Future items
        { ...mockItem, itemId: '5', itemType: 'letter', reviewCount: 1, interval: 10, dueDate: now + dayMs },
        // New items
        { ...mockItem, itemId: '6', itemType: 'letter', reviewCount: 0, interval: 0, dueDate: now },
        { ...mockItem, itemId: '7', itemType: 'vocabulary', reviewCount: 0, interval: 0, dueDate: now }
      ];
    });

    it('should return only due items by default', () => {
      const result = engine.getDailyQueue(items);

      expect(result.queue.length).toBe(4); // 4 due items
      expect(result.stats.totalDue).toBe(4);
      expect(result.stats.totalNew).toBe(2);
      expect(result.hasOverflow).toBe(false);
    });

    it('should include new items when requested', () => {
      const result = engine.getDailyQueue(items, { includeNew: true, maxNew: 1 });

      expect(result.queue.length).toBe(5); // 4 due + 1 new
      expect(result.stats.queueSize).toBe(5);
    });

    it('should respect maxReviews limit', () => {
      const result = engine.getDailyQueue(items, { maxReviews: 2 });

      expect(result.queue.length).toBe(2);
      expect(result.hasOverflow).toBe(true); // More items available
    });

    it('should sort by priority (overdue first)', () => {
      const result = engine.getDailyQueue(items);

      // Most overdue should be first (item 3 - 2 days overdue)
      expect(result.queue[0].itemId).toBe('3');
    });

    it('should provide accurate statistics', () => {
      const result = engine.getDailyQueue(items, { includeNew: true, maxNew: 2 });

      expect(result.stats.totalDue).toBe(4);
      expect(result.stats.totalNew).toBe(2);
      expect(result.stats.queueSize).toBeGreaterThan(0);
      expect(result.stats.byType).toHaveProperty('letter');
      expect(result.stats.byType).toHaveProperty('vocabulary');
      expect(result.stats.byType).toHaveProperty('grammar');
    });

    it('should handle empty item list', () => {
      const result = engine.getDailyQueue([]);

      expect(result.queue).toEqual([]);
      expect(result.stats.totalDue).toBe(0);
      expect(result.stats.totalNew).toBe(0);
      expect(result.hasOverflow).toBe(false);
    });

    it('should respect maxNew limit', () => {
      const result = engine.getDailyQueue(items, { includeNew: true, maxNew: 1, maxReviews: 100 });

      const newItemsInQueue = result.queue.filter(item => item.reviewCount === 0);
      expect(newItemsInQueue.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getForecast', () => {
    it('should return forecast for specified number of days', () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      const items = [
        { ...mockItem, dueDate: now + 1 * dayMs },
        { ...mockItem, dueDate: now + 1 * dayMs },
        { ...mockItem, dueDate: now + 2 * dayMs },
        { ...mockItem, dueDate: now + 5 * dayMs }
      ];

      const forecast = engine.getForecast(items, 7);

      expect(forecast.length).toBe(7);
      expect(forecast[1].dueCount).toBe(2); // Day 1: 2 items
      expect(forecast[2].dueCount).toBe(1); // Day 2: 1 item
      expect(forecast[5].dueCount).toBe(1); // Day 5: 1 item
      expect(forecast[0].dueCount).toBe(0); // Today: 0 items
    });

    it('should include date information', () => {
      const forecast = engine.getForecast([], 3);

      expect(forecast[0].day).toBe(0);
      expect(forecast[0].date).toBeInstanceOf(Date);
      expect(forecast[2].day).toBe(2);
    });
  });

  describe('getItemStats', () => {
    it('should calculate success rate correctly', () => {
      const item = {
        ...mockItem,
        reviewCount: 10,
        lapseCount: 2
      };

      const stats = engine.getItemStats(item);

      expect(stats.successRate).toBe(80); // (10 - 2) / 10 = 80%
      expect(stats.totalReviews).toBe(10);
      expect(stats.lapseCount).toBe(2);
    });

    it('should handle items with no reviews', () => {
      const stats = engine.getItemStats(mockItem);

      expect(stats.successRate).toBe(0);
      expect(stats.totalReviews).toBe(0);
      expect(stats.maturity).toBe(MATURITY.NEW);
    });

    it('should calculate average recent grade', () => {
      const item = {
        ...mockItem,
        recentGrades: [3, 4, 5, 4, 5]
      };

      const stats = engine.getItemStats(item);

      expect(stats.avgRecentGrade).toBeCloseTo(4.2, 1);
    });

    it('should calculate current streak', () => {
      const item = {
        ...mockItem,
        recentGrades: [3, 4, 5, 4, 5, 5]
      };

      const stats = engine.getItemStats(item);

      expect(stats.currentStreak).toBe(6); // All successful
    });

    it('should calculate days until next review', () => {
      const dayMs = 24 * 60 * 60 * 1000;
      const item = {
        ...mockItem,
        dueDate: Date.now() + 5 * dayMs
      };

      const stats = engine.getItemStats(item);

      expect(stats.nextReviewIn).toBe(5);
    });
  });

  describe('getCurrentStreak', () => {
    it('should count successful reviews from the end', () => {
      expect(engine.getCurrentStreak([3, 4, 5])).toBe(3);
      expect(engine.getCurrentStreak([2, 3, 4, 5])).toBe(3);
      expect(engine.getCurrentStreak([3, 2, 3, 4])).toBe(2);
    });

    it('should return 0 for failed streaks', () => {
      expect(engine.getCurrentStreak([2, 2, 2])).toBe(0);
      expect(engine.getCurrentStreak([3, 4, 2])).toBe(0);
    });

    it('should handle empty or missing grades', () => {
      expect(engine.getCurrentStreak([])).toBe(0);
      expect(engine.getCurrentStreak(null)).toBe(0);
      expect(engine.getCurrentStreak(undefined)).toBe(0);
    });
  });

  describe('createDefaultEngine', () => {
    it('should create engine with default settings', () => {
      const defaultEngine = createDefaultEngine();

      expect(defaultEngine).toBeInstanceOf(SRSEngine);
      expect(defaultEngine.minEaseFactor).toBe(1.3);
      expect(defaultEngine.initialEaseFactor).toBe(2.5);
      expect(defaultEngine.maxReviewsPerDay).toBe(200);
      expect(defaultEngine.maxNewPerDay).toBe(20);
    });
  });

  describe('Custom engine configurations', () => {
    it('should allow custom settings', () => {
      const customEngine = new SRSEngine({
        minEaseFactor: 1.5,
        initialEaseFactor: 3.0,
        easyBonus: 1.5,
        maxReviewsPerDay: 50,
        maxNewPerDay: 10
      });

      expect(customEngine.minEaseFactor).toBe(1.5);
      expect(customEngine.initialEaseFactor).toBe(3.0);
      expect(customEngine.easyBonus).toBe(1.5);
      expect(customEngine.maxReviewsPerDay).toBe(50);
      expect(customEngine.maxNewPerDay).toBe(10);
    });
  });

  describe('Integration test: Full review cycle', () => {
    it('should handle complete learning progression', () => {
      let item = { ...mockItem };

      // First review - good response
      item = engine.processReview(item, 4);
      expect(item.interval).toBe(1);
      expect(item.reviewCount).toBe(1);

      // Second review - good response
      item = engine.processReview(item, 4);
      expect(item.interval).toBe(6);
      expect(item.reviewCount).toBe(2);

      // Third review - easy response
      item = engine.processReview(item, 5);
      expect(item.interval).toBeGreaterThan(6);
      expect(item.reviewCount).toBe(3);

      // Fourth review - forgot (lapse)
      item = engine.processReview(item, 2);
      expect(item.interval).toBe(0);
      expect(item.lapseCount).toBe(1);
      expect(item.reviewCount).toBe(4);

      // Fifth review - relearning
      item = engine.processReview(item, 4);
      expect(item.interval).toBe(1); // Back to start
      expect(item.reviewCount).toBe(5);
    });
  });
});
