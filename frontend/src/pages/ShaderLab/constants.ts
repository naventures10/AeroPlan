import type { ShaderDefinition } from './types';

export const shaderSources: Record<string, string> = import.meta.glob('../../shaders/**/*.wgsl', {
  eager: true,
  import: 'default',
  query: '?raw',
});

export const airwayNetworkBackgroundPath = '../../shaders/airway_network/airway-network-bg.wgsl';
export const airwayNetworkNodesPath = '../../shaders/airway_network/airway-network-nodes.wgsl';

export const defaultCursorPosition: [number, number] = [0.5, 0.52];
export const fullscreenUniformByteLength = 48;

export const shaderDefinitions: ShaderDefinition[] = [
  {
    id: 'airway-network',
    label: 'Airway Network',
    category: 'Airway Network',
    kind: 'network',
    shaderPath: airwayNetworkBackgroundPath,
    sourceLabel: '../shaders/airway_network/airway-network-{bg,edges,nodes}.wgsl',
    accent: 'from-sky-300 via-cyan-400 to-emerald-400',
    summary:
      'An interactive ATS graph where navaids and waypoints relay pulses, route traffic, and hover-driven signal propagation.',
    detail:
      'The graph now renders as dedicated node and edge geometry, with a separate atmospheric background pass instead of a single fullscreen fragment loop.',
    tags: ['Interactive', 'Navaids', 'ATS Routes'],
    interactionHint: 'Hover over nodes to emit signals through connected corridors.',
  },
  {
    id: 'ion-storm',
    label: 'Ion Storm',
    category: 'Examples',
    kind: 'fullscreen',
    shaderPath: '../../shaders/examples/ion-storm.wgsl',
    accent: 'from-cyan-300 via-sky-400 to-blue-500',
    summary: 'Layered plasma bands with scanline energy and time-driven turbulence.',
    detail:
      'A fullscreen fragment shader with animated distortion, color mixing, and filmic vignette shaping.',
    tags: ['Procedural', 'Animated', 'Fullscreen'],
  },
  {
    id: 'topo-pulse',
    label: 'Topo Pulse',
    category: 'Examples',
    kind: 'fullscreen',
    shaderPath: '../../shaders/examples/topo-pulse.wgsl',
    accent: 'from-lime-300 via-emerald-400 to-teal-500',
    summary: 'Topographic rings, drifting interference fields, and altitude-like contour lines.',
    detail:
      'Good for tuning signed-distance style bands, temporal modulation, and palette transitions.',
    tags: ['Contours', 'SDF', 'Fullscreen'],
  },
  {
    id: 'radar-ping',
    label: 'Radar Ping',
    category: 'Examples',
    kind: 'fullscreen',
    shaderPath: '../../shaders/examples/radar-ping.wgsl',
    accent: 'from-emerald-400 via-teal-500 to-cyan-600',
    summary: 'Procedural radar ping rings with phosphor-like trailing edges.',
    detail:
      'Demonstrates smoothstep-based ring generation, time-driven animation, and spatial fading.',
    tags: ['Radar', 'Rings', 'SDF'],
  },
  {
    id: 'radar-sweep',
    label: 'Radar Sweep',
    category: 'Examples',
    kind: 'fullscreen',
    shaderPath: '../../shaders/examples/radar-sweep.wgsl',
    accent: 'from-rose-400 via-orange-500 to-amber-600',
    summary: 'Angular sweep effect with polar coordinates and grid overlay.',
    detail: 'Uses atan2 for angular logic and coordinate fractals for grid generation.',
    tags: ['Polar', 'Sweep', 'Grid'],
  },
  {
    id: 'grid-overlay',
    label: 'Grid Overlay',
    category: 'Examples',
    kind: 'fullscreen',
    shaderPath: '../../shaders/examples/grid-overlay.wgsl',
    accent: 'from-blue-400 via-indigo-500 to-violet-600',
    summary: 'Coordinate-aligned grid system with pulse modulation.',
    detail: 'Efficient grid rendering using coordinate fractals and smoothstep sharpening.',
    tags: ['UI', 'Grid', 'Math'],
  },
  {
    id: 'color-hsb',
    label: 'Color HSB',
    category: 'Examples',
    kind: 'fullscreen',
    shaderPath: '../../shaders/examples/color-hsb.wgsl',
    accent: 'from-fuchsia-400 via-purple-500 to-pink-600',
    summary: 'Animate color spectrum and interference patterns.',
    detail: 'Conversion of HSB to RGB color space for dynamic palette generation.',
    tags: ['Color', 'Spectrum', 'Interference'],
  },
  {
    id: 'bloom-pass',
    label: 'Bloom Pass',
    category: 'Examples',
    kind: 'fullscreen',
    shaderPath: '../../shaders/examples/bloom-pass.wgsl',
    accent: 'from-orange-300 via-amber-400 to-yellow-500',
    summary: 'Cinematic post-process bloom using analytical SDF blurring and HDR tonemapping.',
    detail:
      'Replicates professional bloom pipelines with 1:1 Jodie-Reinhard tonemapping, double-pow linearization, and high-performance multi-LOD analytical blurring.',
    tags: ['Post-Process', 'Bloom', 'Tonemapping'],
  },
  {
    id: 'triangle-aa',
    label: 'AA Study',
    category: 'Lab',
    kind: 'comparison',
    shaderPath: '../../shaders/lab/triangle.wgsl',
    accent: 'from-orange-400 via-amber-300 to-rose-400',
    summary: 'Three triangles comparing aliased edges, barycentric smoothing, and 4x MSAA.',
    detail:
      'Useful for checking edge quality, blend setup, and how shader AA compares to hardware multisampling.',
    tags: ['Barycentric', 'MSAA', 'Geometry'],
  },
  {
    id: 'radio-nav-icons',
    label: 'Radio Nav Icons',
    category: 'Lab',
    kind: 'fullscreen',
    shaderPath: '../../shaders/lab/radio_nav_icons.wgsl',
    accent: 'from-cyan-400 via-blue-500 to-indigo-600',
    summary: 'SDF-based radio navigation icons including VOR, DME, and VORTAC patterns.',
    detail:
      'Renders precise aeronautical icons using Signed Distance Fields (SDF) with consistent line weight.',
    tags: ['SDF', 'Icons', 'Aeronautical'],
  },
];
