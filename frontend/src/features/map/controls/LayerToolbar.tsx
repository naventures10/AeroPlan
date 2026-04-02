import { Button } from '@heroui/react';
import { Target, Navigation, Radio, Route } from 'lucide-react';
import { useMapStore } from '../../../store/useMapStore';

/**
 * Left-side vertical toolbar with layer toggle buttons.
 * Visible only in ENROUTE view mode.
 */
export default function LayerToolbar() {
  const { activeLayers, toggleLayer } = useMapStore();

  const toggleButtons = [
    {
      icon: Target,
      id: 'aerodromes' as const,
      color: 'text-indigo-400',
      border: 'border-indigo-500/50',
      bg: 'bg-indigo-500/20',
    },
    {
      icon: Navigation,
      id: 'waypoints' as const,
      color: 'text-violet-400',
      border: 'border-violet-500/50',
      bg: 'bg-violet-500/20',
    },
    {
      icon: Radio,
      id: 'navaids' as const,
      color: 'text-emerald-400',
      border: 'border-emerald-500/50',
      bg: 'bg-emerald-500/20',
    },
    {
      icon: Route,
      id: 'atsRoutes' as const,
      color: 'text-cyan-400',
      border: 'border-cyan-500/50',
      bg: 'bg-cyan-500/20',
    },
  ];

  return (
    <div className="absolute top-1/2 left-6 -translate-y-1/2 flex flex-col gap-3 pointer-events-auto">
      {toggleButtons.map(({ icon: Icon, id, color, border, bg }) => {
        const isActive = activeLayers[id];
        return (
          <Button
            key={id}
            isIconOnly
            radius="full"
            variant="flat"
            onPress={() => toggleLayer(id)}
            title={`Toggle ${id}`}
            className={`backdrop-blur-2xl shadow-xl transition-all duration-300 ${
              isActive
                ? `${bg} ${color} border ${border} shadow-[0_0_15px_rgba(0,0,0,0.2)]`
                : 'bg-zinc-950/40 border border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 opacity-80'
            }`}
          >
            <Icon size={18} />
          </Button>
        );
      })}
    </div>
  );
}
