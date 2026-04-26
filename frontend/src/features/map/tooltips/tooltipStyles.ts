/**
 * Shared tooltip inline style used by both DeckGL and MapLibre tooltips.
 */
export const tooltipStyle: Record<string, string> = {
  backgroundColor: 'rgba(9,9,11,0.65)',
  border: '1px solid rgba(39,39,42,0.7)',
  color: 'white',
  borderRadius: '16px',
  padding: '12px 16px',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  fontFamily: 'system-ui, sans-serif',
  zIndex: '1000',
};
