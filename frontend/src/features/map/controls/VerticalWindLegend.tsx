export function VerticalWindLegend() {
  return (
    <div className="wind-legend-v wind-panel">
      <div className="wind-legend-v__title">
        Wind
        <br />
        (kt)
      </div>
      <div className="wind-legend-v__track">
        <div className="wind-legend-v__ticks">
          <span className="wind-legend-v__tick">120</span>
          <span className="wind-legend-v__tick">80</span>
          <span className="wind-legend-v__tick">40</span>
          <span className="wind-legend-v__tick">0</span>
        </div>
      </div>
    </div>
  );
}
