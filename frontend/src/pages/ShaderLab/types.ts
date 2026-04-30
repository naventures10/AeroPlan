export type ShaderKind = 'comparison' | 'fullscreen' | 'network';

export type ShaderDefinition = {
  id: string;
  label: string;
  category: 'Airway Network' | 'Examples' | 'Lab';
  kind: ShaderKind;
  shaderPath: string;
  sourceLabel?: string;
  accent: string;
  summary: string;
  detail: string;
  tags: string[];
  interactionHint?: string;
};

export type LoadedShaderDefinition = ShaderDefinition & {
  code: string;
};

export type FullscreenUniforms = {
  resolution: [number, number];
  cursor: [number, number];
  metadata: [number, number, number, number, number, number, number, number];
};

export type NetworkNode = {
  position: [number, number];
  size: number;
  nodeType: number;
  frequencyNorm: number;
  hoverRadius: number;
};

export type GPUInfo = {
  vendor: string;
  architecture: string;
  device: string;
};

export type GPUMetrics = {
  fps: number;
  frameTime: number;
  history: number[];
};

export type PresentationSize = {
  width: number;
  height: number;
};

export type NavIconConfig = {
  ringCount: number;
  ringSpacing: number;
  rotation: number;
  dotDensity: number;
};
