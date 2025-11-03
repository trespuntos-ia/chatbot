interface ProgressBarProps {
  current: number;
  total: number | null;
  message?: string;
}

export function ProgressBar({ current, total, message }: ProgressBarProps) {
  const percentage = total ? Math.round((current / total) * 100) : 0;
  const displayMessage = message || `Obteniendo productos... ${current}${total ? ` / ${total}` : ''}`;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{displayMessage}</span>
        <span className="text-slate-500">
          {total ? `${percentage}%` : `${current} productos`}
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500 rounded-full transition-all duration-300 ease-out relative"
          style={{ width: total ? `${percentage}%` : `${Math.min(current * 2, 100)}%` }}
        >
          <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

