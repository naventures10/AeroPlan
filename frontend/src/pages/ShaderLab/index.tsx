import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { shaderDefinitions, shaderSources } from './constants';
import type { LoadedShaderDefinition, NdbIconConfig } from './types';
import { useWebGPU } from './hooks/useWebGPU';

// Components
import { ShaderHeader } from './components/ShaderHeader';
import { PerformanceStats } from './components/PerformanceStats';
import { ShaderLibrary } from './components/ShaderLibrary';
import { ShaderSourceInfo } from './components/ShaderSourceInfo';
import { LabControls } from './components/LabControls';

export default function ShaderLab() {
  const navigate = useNavigate();
  const [activeShaderId, setActiveShaderId] = useState(shaderDefinitions[0]?.id ?? '');
  const [showUI, setShowUI] = useState(true);
  const [showStats, setShowStats] = useState(false);

  // Lab Controls State
  const [ndbIconConfig, setNdbIconConfig] = useState<NdbIconConfig>({
    ringCount: 2,
    ringSpacing: 0.35,
    rotation: 0,
    dotDensity: 1.0,
    circleRadius: 0.55,
    lineLength: 0.1,
    tickCount: 12,
    tickLength: 0.04,
  });
  const ndbIconConfigRef = useRef(ndbIconConfig);

  useEffect(() => {
    ndbIconConfigRef.current = ndbIconConfig;
  }, [ndbIconConfig]);

  // Resolve active shader with code
  const activeShader = useMemo((): LoadedShaderDefinition => {
    const def = shaderDefinitions.find((s) => s.id === activeShaderId) ?? shaderDefinitions[0]!;
    const source = shaderSources[def.shaderPath];

    let code = '';
    if (typeof source === 'string') {
      code = source;
    } else if (source && typeof source === 'object' && 'default' in source) {
      code = (source as { default: string }).default;
    }

    return {
      ...def,
      code,
    };
  }, [activeShaderId]);

  const { canvasRef, status, gpuInfo, metrics, currentPresentationSize } = useWebGPU(
    activeShader,
    ndbIconConfigRef,
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#020611] text-white">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.1),_transparent_30%),linear-gradient(180deg,_#020611_0%,_#050b14_48%,_#020611_100%)]" />

      {/* WebGPU Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      {/* Decorative Grid Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.08]" />

      {/* UI Overlay Layer */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 md:p-6">
        {/* Top Section */}
        <div className="flex items-start justify-between gap-4">
          <ShaderHeader shader={activeShader} show={showUI} onBack={() => navigate('/')} />

          <PerformanceStats
            show={showStats}
            status={status}
            gpuInfo={gpuInfo}
            metrics={metrics}
            size={currentPresentationSize}
            onToggle={() => setShowStats(!showStats)}
            onClose={() => setShowStats(false)}
            showUI={showUI}
            onToggleUI={() => setShowUI(!showUI)}
          />
        </div>

        {/* Mid-Left Section (Shader-specific controls) */}
        <LabControls shaderId={activeShaderId} config={ndbIconConfig} onChange={setNdbIconConfig} />

        {/* Bottom Section */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <ShaderLibrary
            shaders={shaderDefinitions.map((d) => ({ ...d, code: '' }))}
            activeShaderId={activeShaderId}
            show={showUI}
            onSelect={setActiveShaderId}
          />
          <ShaderSourceInfo shader={activeShader} show={showUI} />
        </div>
      </div>

      {/* Error Messaging */}
      {status === 'unsupported' && (
        <div className="absolute bottom-5 inset-x-5 rounded-[24px] border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100 backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-500">
          WebGPU is not supported in this browser. Please use a modern browser like Chrome or Edge.
        </div>
      )}
      {status === 'error' && (
        <div className="absolute bottom-5 inset-x-5 rounded-[24px] border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100 backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-500">
          Shader initialization failed. Check console for WGSL validation errors.
        </div>
      )}
    </div>
  );
}
