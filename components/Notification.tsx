
import React from 'react';

interface NotificationProps {
  message: string;
  type: 'info' | 'error';
}

const Notification: React.FC<NotificationProps> = ({ message, type }) => {
  return (
    <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[100] transition-all animate-bounce-short border-2 ${
      type === 'info' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-red-600 border-red-400 text-white'
    }`}>
      <span className="font-bold">{message}</span>
    </div>
  );
};

export default Notification;
