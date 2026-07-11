import { X } from 'lucide-react';
import { useMapStore } from '../../../store/useMapStore';
import type { WindStatus } from '../layers/useWindLayer';

export function StatusBadge({ status }: { status: WindStatus }) {
  let stateClass = 'status--idle';
  switch (status.state) {
    case 'loading':
      stateClass = 'status--loading';
      break;
    case 'ready':
      stateClass = 'status--ready';
      break;
    case 'error':
      stateClass = 'status--error';
      break;
    default:
      stateClass = 'status--idle';
  }

  const setIsWindMode = useMapStore((s) => s.setIsWindMode);
  const setIsCloudMode = useMapStore((s) => s.setIsCloudMode);
  const setIsWeatherMode = useMapStore((s) => s.setIsWeatherMode);

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
        className="ml-3 p-1 rounded-full transition-colors pointer-events-auto flex items-center justify-center text-on-surface-variant hover:text-on-surface"
        title="Close Weather Layer"
      >
        <X size={14} />
      </button>
    </div>
  );
}
