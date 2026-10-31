import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      <p className="text-xs">{message}</p>
    </div>
  );
};
