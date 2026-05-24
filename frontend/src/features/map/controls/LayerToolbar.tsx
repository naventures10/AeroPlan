import { useState } from 'react';
import HoverTooltip from '../../../components/HoverTooltip';
import { useMapStore } from '../../../store/useMapStore';
import './LayerToolbar.css';
import MenuDrawer from './MenuDrawer';

/**
 * Left-side vertical toolbar with layer toggle buttons.
 * Visible only in ENROUTE view mode.
 */
export default function LayerToolbar() {
  const { activeLayers, toggleLayer, isWeatherMode, setIsWeatherMode } = useMapStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
        <HoverTooltip<HTMLButtonElement> content="Toggle menu">
          {({ ref, interestfor, className }) => (
            <button
              ref={ref}
              interestfor={interestfor}
              id="aip-menu-toggle-btn"
              onClick={() => setIsDrawerOpen((prev) => !prev)}
              className={`aip-layer-toggle ${className} ${isDrawerOpen ? 'active' : ''}`}
              aria-label="Toggle menu"
              aria-expanded={isDrawerOpen}
              aria-controls="aip-menu-drawer"
            >
              <span className="aip-layer-icon aip-icon-menu" />
            </button>
          )}
        </HoverTooltip>

        {toggleButtons.map(({ id, title, iconClass }) => {
          const isActive = id === 'weather' ? isWeatherMode : activeLayers[id];
          return (
            <HoverTooltip<HTMLButtonElement> key={id} content={title}>
              {({ ref, interestfor, className }) => (
                <button
                  ref={ref}
                  interestfor={interestfor}
                  aria-label={`Toggle ${title}`}
                  onClick={() => {
                    if (id === 'weather') {
                      setIsWeatherMode(!isWeatherMode);
                    } else {
                      toggleLayer(id);
                    }
                  }}
                  className={`aip-layer-toggle ${className} ${isActive ? 'active' : ''}`}
                >
                  <span className={`aip-layer-icon ${iconClass}`} />
                </button>
              )}
            </HoverTooltip>
          );
        })}
      </div>

      <MenuDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}
