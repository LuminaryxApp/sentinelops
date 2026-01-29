import { useStore } from '../hooks/useStore';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const iconMap = {
  success: <CheckCircle size={18} className="text-green-400" />,
  error: <AlertCircle size={18} className="text-red-400" />,
  warning: <AlertTriangle size={18} className="text-yellow-400" />,
  info: <Info size={18} className="text-blue-400" />,
};

const bgMap = {
  success: 'border-green-600',
  error: 'border-red-600',
  warning: 'border-yellow-600',
  info: 'border-blue-600',
};

export default function Notifications() {
  const { notifications, removeNotification } = useStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-4 z-50 flex flex-col gap-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`toast border-l-4 ${bgMap[notification.type]} flex items-start gap-3 min-w-[300px] max-w-[400px]`}
        >
          {iconMap[notification.type]}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[#E5E5E5]">{notification.title}</p>
            <p className="text-sm text-[#A0A0A0] truncate">{notification.message}</p>
          </div>
          <button
            onClick={() => removeNotification(notification.id)}
            className="p-1 hover:bg-[#3E3E42] rounded text-[#808080] hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
