'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isRegister) {
      if (password !== confirmPassword) {
        setError('两次密码输入不一致');
        setLoading(false);
        return;
      }
      const res = await register(email, username || email.split('@')[0], password);
      if (!res.ok) setError(res.error || '注册失败');
    } else {
      const res = await login(email, password);
      if (!res.ok) setError(res.error || '登录失败');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e17]">
      <div className="w-full max-w-md p-8">
        <div className="bg-[#111827] border border-[#1e293b] rounded p-8">
          <h1 className="text-2xl font-bold text-[#e2e8f0] mb-2 text-center">
            A股智能分析系统
          </h1>
          <p className="text-[#94a3b8] text-sm text-center mb-8">
            {isRegister ? '创建新账户' : '登录以继续'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0e17] border border-[#1e293b] rounded px-3 py-2 text-[#e2e8f0] focus:border-[#3b82f6] focus:outline-none"
                placeholder="your@email.com"
                required
              />
            </div>

            {isRegister && (
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#0a0e17] border border-[#1e293b] rounded px-3 py-2 text-[#e2e8f0] focus:border-[#3b82f6] focus:outline-none"
                  placeholder="可选"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0e17] border border-[#1e293b] rounded px-3 py-2 text-[#e2e8f0] focus:border-[#3b82f6] focus:outline-none"
                placeholder="至少6个字符"
                required
                minLength={6}
              />
            </div>

            {isRegister && (
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#0a0e17] border border-[#1e293b] rounded px-3 py-2 text-[#e2e8f0] focus:border-[#3b82f6] focus:outline-none"
                  placeholder="再次输入密码"
                  required
                />
              </div>
            )}

            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-900/50 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3b82f6] text-white py-2 rounded hover:bg-[#2563eb] disabled:opacity-50 transition-colors"
            >
              {loading ? '处理中...' : isRegister ? '注册' : '登录'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-[#3b82f6] text-sm hover:underline"
            >
              {isRegister ? '已有账户？去登录' : '没有账户？去注册'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
