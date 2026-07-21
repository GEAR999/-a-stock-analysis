/**
 * 数据源集成测试
 * 测试真实数据源连接
 * 默认跳过，需要手动运行：jest --testPathPattern=integration
 */

describe('Data Sources Integration', () => {
  describe.skip('East Money API', () => {
    it('should connect to East Money search API', async () => {
      // This test is skipped by default
      // Run with: jest --testPathPattern=integration
      const response = await fetch('https://searchapi.eastmoney.com/api/suggest/get?input=000858&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=5');
      expect(response.ok).toBe(true);
    });

    it('should connect to East Money quote API', async () => {
      const response = await fetch('https://push2.eastmoney.com/api/qt/stock/get?secid=0.000858&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60');
      expect(response.ok).toBe(true);
    });
  });

  describe.skip('mootdx Server', () => {
    it('should connect to mootdx health endpoint', async () => {
      const response = await fetch('http://47.122.115.203:8888/health');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe('ok');
    });

    it('should get quote from mootdx', async () => {
      const response = await fetch('http://47.122.115.203:8888/api/quote?code=000858');
      expect(response.ok).toBe(true);
    });
  });
});
