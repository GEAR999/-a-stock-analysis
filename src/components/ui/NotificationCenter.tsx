"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, TrendingUp, DollarSign, Settings, Check, Trash2 } from "lucide-react";

interface Notification {
  id: string;
  type: "signal" | "price" | "system";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  link?: string;
}

const STORAGE_KEY = "app-notifications";
const MAX_NOTIFICATIONS = 100;

// 从 IndexedDB/localStorage 加载通知
function loadNotifications(): Notification[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 保存通知到 localStorage
function saveNotifications(notifications: Notification[]) {
  try {
    // 限制最多100条
    const trimmed = notifications.slice(0, MAX_NOTIFICATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

// 添加通知的全局函数
export function addNotification(notification: Omit<Notification, "id" | "timestamp" | "read">) {
  const notifications = loadNotifications();
  const newNotification: Notification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    read: false,
  };
  notifications.unshift(newNotification);
  saveNotifications(notifications);
  // 触发自定义事件通知UI更新
  window.dispatchEvent(new CustomEvent("notifications-updated"));
  return newNotification;
}

// 获取未读通知数量
export function getUnreadCount(): number {
  return loadNotifications().filter(n => !n.read).length;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // 加载通知
  useEffect(() => {
    setNotifications(loadNotifications());

    const handleUpdate = () => setNotifications(loadNotifications());
    window.addEventListener("notifications-updated", handleUpdate);
    return () => window.removeEventListener("notifications-updated", handleUpdate);
  }, []);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    saveNotifications(updated);
  };

  const deleteNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    saveNotifications(updated);
  };

  const clearAll = () => {
    setNotifications([]);
    saveNotifications([]);
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "signal": return <TrendingUp className="w-4 h-4 text-[var(--accent-blue)]" />;
      case "price": return <DollarSign className="w-4 h-4 text-amber-400" />;
      case "system": return <Settings className="w-4 h-4 text-[var(--text-secondary)]" />;
    }
  };

  const getTypeColor = (type: Notification["type"]) => {
    switch (type) {
      case "signal": return "border-l-blue-400";
      case "price": return "border-l-amber-400";
      case "system": return "border-l-gray-400";
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return new Date(timestamp).toLocaleDateString("zh-CN");
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50 transition-colors"
        title="消息通知"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)] bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[500px] bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg shadow-2xl overflow-hidden z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">消息通知</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-[var(--accent-red)] rounded">
                  {unreadCount} 未读
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-[var(--accent-blue)] hover:text-blue-300 transition-colors"
                  title="全部已读"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-colors"
                  title="清空全部"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Bell className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-xs text-[var(--text-secondary)]">暂无通知</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-[var(--border-default)] border-l-2 ${getTypeColor(notif.type)} cursor-pointer transition-colors ${
                    notif.read ? "bg-transparent hover:bg-[var(--bg-card)]/30" : "bg-blue-500/5 hover:bg-blue-500/10"
                  }`}
                >
                  <div className="shrink-0 mt-0.5">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-xs truncate ${notif.read ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)] font-medium"}`}>
                        {notif.title}
                      </h4>
                      {!notif.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">{formatTime(notif.timestamp)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                    className="shrink-0 p-1 text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors"
                    title="删除"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-[var(--border-default)] text-center">
              <span className="text-[10px] text-[var(--text-secondary)]">共 {notifications.length} 条通知</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
