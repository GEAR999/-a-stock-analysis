'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  moduleName?: string;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[ErrorBoundary] 模块 "${this.props.moduleName || '未知'}" 发生错误:`,
      error,
      errorInfo
    );
    this.setState({ errorInfo });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = process.env.NODE_ENV === 'development';

      return (
        <div className="flex items-center justify-center min-h-[200px] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-sm p-6">
          <div className="text-center max-w-md">
            <div className="text-amber-500 text-lg font-medium mb-2">
              该模块加载异常
            </div>
            <div className="text-slate-400 text-sm mb-4">
              {this.props.moduleName ? `"${this.props.moduleName}" 模块出现渲染错误` : '组件渲染时发生未知错误'}
            </div>
            <button
              onClick={this.handleRetry}
              className="px-4 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card)] text-slate-300 text-sm rounded border border-[var(--border-default)] transition-colors"
            >
              重试
            </button>
            {isDev && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-400">
                  错误详情 (开发模式)
                </summary>
                <div className="mt-2 p-3 bg-[var(--bg-panel)] rounded border border-[var(--border-default)] overflow-auto max-h-48">
                  <div className="text-[var(--accent-red)] text-xs font-mono mb-2">
                    {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <pre className="text-slate-500 text-xs font-mono whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
