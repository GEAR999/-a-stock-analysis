/**
 * market-sentiment 单元测试
 * 测试大盘情绪指数计算
 */

import { calculateMarketSentiment } from '../market-sentiment';
import type { MarketData } from '../types';

describe('market-sentiment', () => {
  describe('calculateMarketSentiment', () => {
    it('should calculate bullish sentiment correctly', () => {
      const data: MarketData = {
        upCount: 3000,
        downCount: 1000,
        limitUpCount: 100,
        limitDownCount: 10,
        todayVolume: 500000000000,
        avgVolume20: 400000000000,
        maxBoardDays: 7,
        brokenBoardRate: 20,
        northNetFlow: 100,
        marginChange5d: 50,
        newHighCount: 200,
        newLowCount: 50,
        totalStocks: 5000,
      };

      const result = calculateMarketSentiment(data);
      
      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(50);
      // Level is in Chinese
      expect(result.level).toBeDefined();
      expect(result.details).toHaveLength(8);
    });

    it('should calculate bearish sentiment correctly', () => {
      const data: MarketData = {
        upCount: 1000,
        downCount: 3000,
        limitUpCount: 10,
        limitDownCount: 100,
        todayVolume: 200000000000,
        avgVolume20: 400000000000,
        maxBoardDays: 2,
        brokenBoardRate: 80,
        northNetFlow: -100,
        marginChange5d: -50,
        newHighCount: 50,
        newLowCount: 200,
        totalStocks: 5000,
      };

      const result = calculateMarketSentiment(data);
      
      expect(result).toBeDefined();
      expect(result.score).toBeLessThan(50);
      expect(result.level).toBeDefined();
    });

    it('should calculate neutral sentiment correctly', () => {
      const data: MarketData = {
        upCount: 2000,
        downCount: 2000,
        limitUpCount: 50,
        limitDownCount: 50,
        todayVolume: 400000000000,
        avgVolume20: 400000000000,
        maxBoardDays: 4,
        brokenBoardRate: 50,
        northNetFlow: 0,
        marginChange5d: 0,
        newHighCount: 100,
        newLowCount: 100,
        totalStocks: 5000,
      };

      const result = calculateMarketSentiment(data);
      
      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThanOrEqual(60);
      expect(result.level).toBeDefined();
    });

    it('should include all 8 indicators', () => {
      const data: MarketData = {
        upCount: 2500,
        downCount: 1500,
        limitUpCount: 80,
        limitDownCount: 20,
        todayVolume: 450000000000,
        avgVolume20: 400000000000,
        maxBoardDays: 5,
        brokenBoardRate: 30,
        northNetFlow: 50,
        marginChange5d: 30,
        newHighCount: 150,
        newLowCount: 80,
        totalStocks: 5000,
      };

      const result = calculateMarketSentiment(data);
      
      expect(result.details).toHaveLength(8);
    });

    it('should return result with all required fields', () => {
      const data: MarketData = {
        upCount: 3500,
        downCount: 500,
        limitUpCount: 120,
        limitDownCount: 5,
        todayVolume: 600000000000,
        avgVolume20: 400000000000,
        maxBoardDays: 8,
        brokenBoardRate: 10,
        northNetFlow: 150,
        marginChange5d: 80,
        newHighCount: 300,
        newLowCount: 20,
        totalStocks: 5000,
      };

      const result = calculateMarketSentiment(data);
      
      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.level).toBeDefined();
      expect(result.details).toBeDefined();
    });
  });
});
