/**
 * mootdx-client 单元测试
 * 测试 mootdx 行情客户端的核心功能
 */

import {
  isMootdxAvailable,
} from '../mootdx-client';

describe('mootdx-client', () => {
  describe('isMootdxAvailable', () => {
    it('should return availability status', () => {
      const result = isMootdxAvailable();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('module exports', () => {
    it('should export required functions', () => {
      const mootdxClient = require('../mootdx-client');
      expect(typeof mootdxClient.checkHealth).toBe('function');
      expect(typeof mootdxClient.isMootdxAvailable).toBe('function');
      expect(typeof mootdxClient.getQuote).toBe('function');
      expect(typeof mootdxClient.getQuotes).toBe('function');
      expect(typeof mootdxClient.getKline).toBe('function');
    });
  });
});
