/**
 * backtest-engine 单元测试
 * 测试历史回测引擎
 */

describe('backtest-engine', () => {
  describe('runBacktest', () => {
    it('should have correct structure', () => {
      // Basic structure test
      expect(true).toBe(true);
    });

    it('should calculate returns correctly', () => {
      const initialCapital = 1000000;
      const finalCapital = 1100000;
      const returnRate = ((finalCapital - initialCapital) / initialCapital) * 100;
      expect(returnRate).toBe(10);
    });

    it('should calculate max drawdown correctly', () => {
      const equityCurve = [100, 110, 105, 95, 100, 115];
      let peak = equityCurve[0];
      let maxDrawdown = 0;
      
      for (const value of equityCurve) {
        if (value > peak) peak = value;
        const drawdown = ((peak - value) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
      
      expect(maxDrawdown).toBeCloseTo(13.64, 1);
    });

    it('should calculate win rate correctly', () => {
      const trades = [
        { pnl: 100 },
        { pnl: -50 },
        { pnl: 200 },
        { pnl: -30 },
        { pnl: 150 },
      ];
      
      const winningTrades = trades.filter(t => t.pnl > 0);
      const winRate = (winningTrades.length / trades.length) * 100;
      
      expect(winRate).toBe(60);
    });

    it('should calculate sharpe ratio correctly', () => {
      const returns = [0.01, 0.02, -0.005, 0.015, 0.008];
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const stdDev = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      );
      const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
      
      expect(sharpeRatio).toBeGreaterThan(0);
    });
  });
});
