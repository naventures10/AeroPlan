import { useMapStore } from '../../../store/useMapStore';

interface LayerToolbarProps {
  onMenuClick?: () => void;
}

/**
 * Left-side vertical toolbar with layer toggle buttons.
 * Visible only in ENROUTE view mode.
 */
export default function LayerToolbar({ onMenuClick }: LayerToolbarProps = {}) {
  const { activeLayers, toggleLayer, isWeatherMode, setIsWeatherMode } = useMapStore();

  const toggleButtons = [
    { id: 'aerodromes' as const, title: 'Aerodromes', iconClass: 'aip-icon-aerodromes' },
    { id: 'waypoints' as const, title: 'Waypoints', iconClass: 'aip-icon-waypoints' },
    { id: 'navaids' as const, title: 'NavAids', iconClass: 'aip-icon-navaids' },
    { id: 'atsRoutes' as const, title: 'ATS Routes', iconClass: 'aip-icon-atsRoutes' },
    { id: 'airspaces' as const, title: 'Airspaces', iconClass: 'aip-icon-airspaces' },
    { id: 'weather' as const, title: 'Weather', iconClass: 'aip-icon-weather' },
  ];

  return (
    <div className="aip-layer-toolbar-container">
      <div className="aip-layer-toolbar">
        <button onClick={onMenuClick} className="aip-layer-toggle">
          <span className="aip-layer-icon aip-icon-menu" />
        </button>

        {toggleButtons.map(({ id, title, iconClass }) => {
          const isActive = id === 'weather' ? isWeatherMode : activeLayers[id];
          return (
            <button
              key={id}
              aria-label={`Toggle ${title}`}
              onClick={() => {
                if (id === 'weather') {
                  setIsWeatherMode(!isWeatherMode);
                } else {
                  toggleLayer(id);
                }
              }}
              className={`aip-layer-toggle ${isActive ? 'active' : ''}`}
            >
              <span className={`aip-layer-icon ${iconClass}`} />
              <span className="aip-layer-tooltip">{title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
