export default function GlobalLoader() {
  return (
    <div 
      id="placeholder" 
      className="w-screen h-screen flex flex-col items-center justify-center bg-gray-900 text-white select-none fixed inset-0 z-50"
    >
      <div className="w-10 h-10 border-4 border-gray-700 border-t-emerald-500 rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium tracking-wide text-gray-400 animate-pulse font-sans">
        Initializing eAIP Systems...
      </p>
    </div>
  );
}
