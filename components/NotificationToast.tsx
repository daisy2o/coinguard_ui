import React, { useState, useEffect } from 'react';
import { X, Bell, AlertTriangle } from 'lucide-react';
import { WatchNotification } from '../types';

interface NotificationToastProps {
  notification: WatchNotification;
  onClose: () => void;
  onClick: () => void;
  duration?: number;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onClick,
  duration = 5000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className="bg-white rounded-2xl p-4 shadow-xl border border-slate-200 min-w-[320px] max-w-[400px] cursor-pointer hover:shadow-2xl transition-all animate-slide-in-right"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              {notification.watchRuleName}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-slate-800">
              {notification.coinName} ({notification.coinSymbol})
            </span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            {notification.message}
          </p>
          <div className="text-xs text-slate-400 mt-2">
            {new Date(notification.triggeredAt).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface NotificationContainerProps {
  notifications: WatchNotification[];
  onClose: (id: string) => void;
  onNotificationClick: (notification: WatchNotification) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onClose,
  onNotificationClick,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationToast
            notification={notification}
            onClose={() => onClose(notification.id)}
            onClick={() => onNotificationClick(notification)}
          />
        </div>
      ))}
    </div>
  );
};

