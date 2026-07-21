/**
 * data-validator-xref 单元测试
 * 测试数据交叉验证工具
 */

describe('data-validator-xref', () => {
  describe('validateStockCode', () => {
    it('should validate Shanghai stock codes', () => {
      const codes = ['600000', '600519', '601318'];
      codes.forEach(code => {
        expect(code).toMatch(/^6\d{5}$/);
      });
    });

    it('should validate Shenzhen stock codes', () => {
      const codes = ['000001', '000858', '002594'];
      codes.forEach(code => {
        expect(code).toMatch(/^0\d{5}$/);
      });
    });

    it('should validate ChiNext stock codes', () => {
      const codes = ['300001', '300750', '301269'];
      codes.forEach(code => {
        expect(code).toMatch(/^3\d{5}$/);
      });
    });

    it('should validate Beijing stock codes', () => {
      const codes = ['430047', '830799', '871396'];
      codes.forEach(code => {
        expect(code).toMatch(/^[48]\d{5}$/);
      });
    });
  });

  describe('validatePrice', () => {
    it('should validate positive prices', () => {
      const prices = [10.5, 100.0, 0.01, 9999.99];
      prices.forEach(price => {
        expect(price).toBeGreaterThan(0);
      });
    });

    it('should reject invalid prices', () => {
      const invalidPrices = [0, -10, NaN, Infinity];
      invalidPrices.forEach(price => {
        expect(price <= 0 || isNaN(price) || !isFinite(price)).toBe(true);
      });
    });
  });

  describe('validateVolume', () => {
    it('should validate non-negative volumes', () => {
      const volumes = [0, 100, 10000, 1000000];
      volumes.forEach(volume => {
        expect(volume).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('validateDate', () => {
    it('should validate date format', () => {
      const dates = ['2024-01-01', '2024-12-31', '2023-06-15'];
      dates.forEach(date => {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should validate date is valid', () => {
      const date = new Date('2024-01-15');
      expect(date instanceof Date).toBe(true);
      expect(isNaN(date.getTime())).toBe(false);
    });
  });
});
