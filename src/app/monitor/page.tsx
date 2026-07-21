/**
 * 系统监控页面
 * 路由: /monitor
 */

import SystemHealthPanel from '@/components/monitor/SystemHealthPanel';

export const metadata = {
  title: '系统监控 - A股智析',
  description: '数据源健康状态监控',
};

export default function MonitorPage() {
  return (
    <div className="min-h-screen p-4 md:p-6">
      <SystemHealthPanel />
    </div>
  );
}
