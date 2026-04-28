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

  const { setIsWindMode } = useMapStore();

  return (
    <div className={`wind-status wind-panel ${stateClass}`}>
      <span className="wind-status__dot" />
      <span className="wind-status__text">
        {status.state === 'loading' && '⟳ '}
        {status.message || status.state}
      </span>
      <button
        onClick={() => setIsWindMode(false)}
        className="ml-3 p-1 hover:bg-white/10 rounded-full transition-colors pointer-events-auto flex items-center justify-center text-zinc-400 hover:text-white"
        title="Close Wind Layer"
      >
        <X size={14} />
      </button>
    </div>
  );
}
