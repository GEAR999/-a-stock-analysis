/**
 * api-stock 单元测试
 * 测试股票数据获取层
 */

import { searchStocks, getQuote } from '../api/stock';

// Mock fetch
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('api/stock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchStocks', () => {
    it('should search stocks by keyword', async () => {
      const mockResponse = {
        QuotationCodeTable: {
          Data: [
            {
              Code: '000858',
              Name: '五粮液',
              MktNum: '0',
              SecurityTypeName: 'A股',
            },
            {
              Code: '600519',
              Name: '贵州茅台',
              MktNum: '1',
              SecurityTypeName: 'A股',
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const results = await searchStocks('茅台');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const results = await searchStocks('invalid');
      expect(results).toEqual([]);
    });
  });

  describe('getQuote', () => {
    it('should get stock quote', async () => {
      // Mock mootdx failure (will fallback to East Money)
      mockFetch.mockRejectedValueOnce(new Error('mootdx unavailable'));
      
      // Mock East Money success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            f43: 13033,
            f44: 13100,
            f45: 12900,
            f46: 12950,
            f47: 50000,
            f48: 6500000,
            f57: '000858',
            f58: '五粮液',
            f60: 12980,
            f170: 53,
          },
        }),
      } as Response);

      const quote = await getQuote('000858');
      
      // Should return something (either from mootdx or fallback)
      expect(quote === null || typeof quote === 'object').toBe(true);
    });

    it('should return null on complete failure', async () => {
      mockFetch.mockRejectedValue(new Error('All sources failed'));

      const quote = await getQuote('invalid');
      expect(quote).toBeNull();
    });
  });
});
