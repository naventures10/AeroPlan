import { useState } from 'react';
import { useMapStore } from '../../../store/useMapStore';
import './MobileLayerToolbar.css';
import MobileMenuDrawer from './MobileMenuDrawer';

/**
 * Responsive Mobile Layer Toolbar.
 * Floating menu button top-left, horizontal layers dock bottom-center.
 */
export default function MobileLayerToolbar() {
  const { activeLayers, toggleLayer, isWeatherMode, setIsWeatherMode } = useMapStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const toggleButtons = [
    {
      id: 'aerodromes' as const,
      title: 'Aerodromes',
      iconClass: 'aip-icon-aerodromes',
      shortform: 'AD',
    },
    {
      id: 'waypoints' as const,
      title: 'Waypoints',
      iconClass: 'aip-icon-waypoints',
      shortform: 'WPT',
    },
    { id: 'navaids' as const, title: 'NavAids', iconClass: 'aip-icon-navaids', shortform: 'NAV' },
    {
      id: 'atsRoutes' as const,
      title: 'ATS Routes',
      iconClass: 'aip-icon-atsRoutes',
      shortform: 'RTE',
    },
    {
      id: 'airspaces' as const,
      title: 'Airspaces',
      iconClass: 'aip-icon-airspaces',
      shortform: 'ASP',
    },
    { id: 'weather' as const, title: 'Weather', iconClass: 'aip-icon-weather', shortform: 'WX' },
  ];

  return (
    <>
      {/* Floating Menu Trigger (Top-Left) */}
      <button
        type="button"
        data-testid="mobile-menu-trigger"
        onClick={() => setIsDrawerOpen((prev) => !prev)}
        className={`aip-mobile-menu-trigger ${isDrawerOpen ? 'active' : ''}`}
        aria-label="Toggle menu"
        aria-expanded={isDrawerOpen}
        aria-controls="aip-menu-drawer"
      >
        <span className="aip-layer-icon aip-icon-menu" />
      </button>

      {/* Horizontal Floating Layer Dock (Bottom-Center) */}
      <div className="aip-mobile-layer-dock-container">
        <div className="aip-mobile-layer-dock">
          {toggleButtons.map(({ id, title, iconClass, shortform }) => {
            const isActive = id === 'weather' ? isWeatherMode : activeLayers[id];
            return (
              <button
                key={id}
                type="button"
                data-testid={`mobile-layer-toggle-${id}`}
                aria-label={`Toggle ${title}`}
                onClick={() => {
                  if (id === 'weather') {
                    setIsWeatherMode(!isWeatherMode);
                  } else {
                    toggleLayer(id);
                  }
                }}
                className={`aip-mobile-layer-toggle ${isActive ? 'active' : ''}`}
              >
                <span className={`aip-layer-icon ${iconClass}`} />
                <span className="aip-mobile-layer-label">{shortform}</span>
              </button>
            );
          })}
        </div>
      </div>

      <MobileMenuDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
}
