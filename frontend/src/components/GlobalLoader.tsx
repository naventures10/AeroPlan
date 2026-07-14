import './GlobalLoader.css';

export default function GlobalLoader() {
  return (
    <div id="placeholder" className="global-loader-container">
      <div className="global-loader-spinner" />
      <p className="global-loader-text">Initializing AeroInfo Systems...</p>
    </div>
  );
}
