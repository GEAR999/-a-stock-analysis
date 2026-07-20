/**
 * 前端数据访问层 (DAL)
 * 封装所有 API 调用，前端组件不直接调用 fetch
 */

interface ApiResponse<T = unknown> {
  ok: boolean;
  data: T;
  message?: string;
  error?: string;
  code?: string;
  total?: number;
  page?: number;
  pageSize?: number;
}

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include', // 发送 cookie
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    const json = await res.json();
    if (!res.ok && !json.ok) {
      // 401 未授权 → 跳转到登录
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    return json;
  } catch (error) {
    return { ok: false, data: null as T, error: '网络请求失败', code: 'NETWORK_ERROR' };
  }
}

// ===== Auth =====
export const authApi = {
  register: (email: string, username: string, password: string) =>
    request<{ user: { id: string; email: string; username: string }; token: string }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify({ email, username, password }) }
    ),

  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; username: string }; token: string }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  logout: () =>
    request('/api/auth/logout', { method: 'POST' }),

  me: () =>
    request<{ id: string; email: string; username: string }>('/api/auth/me'),
};

// ===== Accounts =====
export const accountsApi = {
  list: () =>
    request<Array<Record<string, unknown>>>('/api/accounts'),

  get: (id: string) =>
    request<Record<string, unknown>>(`/api/accounts/${id}`),

  create: (data: { name: string; type: string; initialCapital?: number }) =>
    request<Record<string, unknown>>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request(`/api/accounts/${id}`, { method: 'DELETE' }),
};

// ===== Positions =====
export const positionsApi = {
  list: (accountId: string) =>
    request<Array<Record<string, unknown>>>(`/api/positions?account_id=${accountId}`),

  update: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/positions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ===== Transactions =====
export const transactionsApi = {
  list: (accountId: string, page = 1, pageSize = 50) =>
    request<Array<Record<string, unknown>>>(
      `/api/transactions?account_id=${accountId}&page=${page}&pageSize=${pageSize}`
    ),

  create: (data: {
    accountId: string;
    stockCode: string;
    stockName: string;
    type: 'buy' | 'sell';
    price: number;
    quantity: number;
    amount: number;
    fee?: number;
    strategySignals?: Record<string, unknown>;
    note?: string;
  }) =>
    request<Record<string, unknown>>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request(`/api/transactions/${id}`, { method: 'DELETE' }),
};

// ===== Custom Strategies =====
export const strategiesApi = {
  listCustom: () =>
    request<Array<Record<string, unknown>>>('/api/strategies/custom'),

  createCustom: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/strategies/custom', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCustom: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/strategies/custom/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCustom: (id: string) =>
    request(`/api/strategies/custom/${id}`, { method: 'DELETE' }),

  // Strategy Weights
  getWeights: (accountId: string) =>
    request<Array<Record<string, unknown>>>(`/api/strategies/weights?account_id=${accountId}`),

  saveWeights: (accountId: string, weights: Array<Record<string, unknown>>) =>
    request('/api/strategies/weights', {
      method: 'POST',
      body: JSON.stringify({ accountId, weights }),
    }),

  // Strategy Templates
  listTemplates: () =>
    request<Array<Record<string, unknown>>>('/api/strategies/templates'),

  createTemplate: (data: Record<string, unknown>) =>
    request('/api/strategies/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTemplate: (data: Record<string, unknown>) =>
    request('/api/strategies/templates', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTemplate: (id: string) =>
    request(`/api/strategies/templates?id=${id}`, { method: 'DELETE' }),
};

// ===== Watchlist =====
export const watchlistApi = {
  list: (group?: string) =>
    request<Array<Record<string, unknown>>>(
      group ? `/api/watchlist?group=${encodeURIComponent(group)}` : '/api/watchlist'
    ),

  add: (data: { stockCode: string; stockName: string; groupName?: string }) =>
    request('/api/watchlist', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  remove: (stockCode: string, group = '默认') =>
    request(`/api/watchlist?stock_code=${stockCode}&group=${encodeURIComponent(group)}`, {
      method: 'DELETE',
    }),
};

// ===== Analysis Cache =====
export const analysisApi = {
  getCache: (stockCode: string, analysisType?: string) =>
    request(
      `/api/analysis/cache?stock_code=${stockCode}${analysisType ? `&analysis_type=${analysisType}` : ''}`
    ),

  setCache: (data: {
    stockCode: string;
    analysisType: string;
    result: Record<string, unknown>;
    score?: number;
    signal?: string;
    expiresInMinutes?: number;
  }) =>
    request('/api/analysis/cache', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ===== Learning Progress =====
export const learningApi = {
  getProgress: (module?: string) =>
    request<Array<Record<string, unknown>>>(
      module ? `/api/learning/progress?module=${module}` : '/api/learning/progress'
    ),

  updateProgress: (data: {
    module: string;
    lessonId: string;
    status?: string;
    progress?: number;
    notes?: string;
  }) =>
    request('/api/learning/progress', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ===== 统一导出 =====
export const api = {
  auth: authApi,
  accounts: accountsApi,
  positions: positionsApi,
  transactions: transactionsApi,
  strategies: strategiesApi,
  watchlist: watchlistApi,
  analysis: analysisApi,
  learning: learningApi,
};
