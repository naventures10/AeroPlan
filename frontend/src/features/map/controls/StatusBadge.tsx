import { X } from 'lucide-react';
import { useMapStore } from '../../../store/useMapStore';
import type { WindStatus } from '../layers/useWindLayer';

export function StatusBadge({ status }: { status: WindStatus }) {
  const stateClass = {
    idle: 'status--idle',
    loading: 'status--loading',
    ready: 'status--ready',
    error: 'status--error',
  }[status.state];

  const { setIsWindMode, setIsCloudMode, setIsWeatherMode } = useMapStore();

  const handleClose = () => {
    setIsWindMode(false);
    setIsCloudMode(false);
    setIsWeatherMode(false);
  };

  return (
    <div className={`wind-status wind-panel ${stateClass}`}>
      <span className="wind-status__dot" />
      <span className="wind-status__text">
        {status.state === 'loading' && '⟳ '}
        {status.message || status.state}
      </span>
      <button
        onClick={handleClose}
        className="ml-3 p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors pointer-events-auto flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
        title="Close Weather Layer"
      >
        <X size={14} />
      </button>
    </div>
  );
}
