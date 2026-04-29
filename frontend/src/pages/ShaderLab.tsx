import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Clock3,
  Cpu,
  MousePointer2,
  Waves,
  X,
  Layout,
  LayoutGrid,
  Library,
  Layers,
  FlaskConical,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  airwayNetworkNodes,
  airwayNetworkEdges,
  airspaceOutlines,
  type NetworkNode,
  type NetworkEdge,
  type AirspaceOutline,
} from '../data/mockRadarData';

type ShaderKind = 'comparison' | 'fullscreen' | 'network';

type ShaderDefinition = {
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

type LoadedShaderDefinition = ShaderDefinition & {
  code: string;
};

type FullscreenUniforms = {
  resolution: [number, number];
  cursor: [number, number];
  metadata: [number, number, number, number];
};

const shaderSources: Record<string, string> = import.meta.glob('../shaders/**/*.wgsl', {
  eager: true,
  import: 'default',
  query: '?raw',
});

const airwayNetworkBackgroundPath = '../shaders/airway_network/airway-network-bg.wgsl';
const airwayNetworkEdgesPath = '../shaders/airway_network/airway-network-edges.wgsl';
const airwayNetworkNodesPath = '../shaders/airway_network/airway-network-nodes.wgsl';
const airwayNetworkOutlinesPath = '../shaders/airway_network/airway-network-outlines.wgsl';

const defaultCursorPosition: [number, number] = [0.5, 0.52];
const fullscreenUniformByteLength = 32;

const shaderDefinitions: ShaderDefinition[] = [
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
    shaderPath: '../shaders/examples/ion-storm.wgsl',
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
    shaderPath: '../shaders/examples/topo-pulse.wgsl',
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
    shaderPath: '../shaders/examples/radar-ping.wgsl',
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
    shaderPath: '../shaders/examples/radar-sweep.wgsl',
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
    shaderPath: '../shaders/examples/grid-overlay.wgsl',
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
    shaderPath: '../shaders/examples/color-hsb.wgsl',
    accent: 'from-fuchsia-400 via-purple-500 to-pink-600',
    summary: 'Animate color spectrum and interference patterns.',
    detail: 'Conversion of HSB to RGB color space for dynamic palette generation.',
    tags: ['Color', 'Spectrum', 'Interference'],
  },
  {
    id: 'triangle-aa',
    label: 'AA Study',
    category: 'Lab',
    kind: 'comparison',
    shaderPath: '../shaders/lab/triangle.wgsl',
    accent: 'from-orange-400 via-amber-300 to-rose-400',
    summary: 'Three triangles comparing aliased edges, barycentric smoothing, and 4x MSAA.',
    detail:
      'Useful for checking edge quality, blend setup, and how shader AA compares to hardware multisampling.',
    tags: ['Barycentric', 'MSAA', 'Geometry'],
  },
];

const shaders: LoadedShaderDefinition[] = shaderDefinitions.map((definition) => ({
  ...definition,
  code: shaderSources[definition.shaderPath] ?? '',
}));

const initialUniforms: FullscreenUniforms = {
  resolution: [1, 1],
  cursor: defaultCursorPosition,
  metadata: [0, -1, 0, 0],
};

function writeFullscreenUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  uniforms: FullscreenUniforms,
) {
  const data = new Float32Array([
    uniforms.resolution[0],
    uniforms.resolution[1],
    uniforms.cursor[0],
    uniforms.cursor[1],
    uniforms.metadata[0],
    uniforms.metadata[1],
    uniforms.metadata[2],
    uniforms.metadata[3],
  ]);
  device.queue.writeBuffer(buffer, 0, data);
}

function createStaticBuffer(device: GPUDevice, data: Float32Array, usage: GPUBufferUsageFlags) {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage,
    mappedAtCreation: true,
  });
  new Float32Array(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
}

function buildNetworkEdgeInstanceData(nodes: NetworkNode[], edges: NetworkEdge[]) {
  const data = new Float32Array(edges.length * 8);
  edges.forEach((edge, index) => {
    const from = nodes[edge.from];
    const to = nodes[edge.to];
    if (!from || !to) return;

    const base = index * 8;
    const width = 0.007 + edge.routeClass * 0.004;

    data[base + 0] = from.position[0];
    data[base + 1] = from.position[1];
    data[base + 2] = to.position[0];
    data[base + 3] = to.position[1];
    data[base + 4] = width;
    data[base + 5] = edge.routeClass;
    data[base + 6] = edge.from;
    data[base + 7] = edge.to;
  });
  return data;
}

function buildNetworkNodeInstanceData(nodes: NetworkNode[]) {
  const data = new Float32Array(nodes.length * 8);
  nodes.forEach((node, index) => {
    const base = index * 8;
    data[base + 0] = node.position[0];
    data[base + 1] = node.position[1];
    data[base + 2] = node.size;
    data[base + 3] = node.nodeType;
    data[base + 4] = index;
    data[base + 5] = node.frequencyNorm;
    data[base + 6] = 0;
    data[base + 7] = 0;
  });
  return data;
}

function buildNetworkOutlineInstanceData(outlines: AirspaceOutline[]) {
  const data = new Float32Array(outlines.length * 4);
  outlines.forEach((outline, index) => {
    const base = index * 4;
    data[base + 0] = outline.start[0];
    data[base + 1] = outline.start[1];
    data[base + 2] = outline.end[0];
    data[base + 3] = outline.end[1];
  });
  return data;
}

function findNearestNetworkNode(cursor: [number, number]) {
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  airwayNetworkNodes.forEach((node, index) => {
    const dx = cursor[0] - node.position[0];
    const dy = cursor[1] - node.position[1];
    const distance = Math.hypot(dx, dy);
    if (distance <= node.hoverRadius && distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

/**
 * WebGPU shader playground backed by WGSL files in src/shaders.
 */
export default function ShaderLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const [activeShaderId, setActiveShaderId] = useState(shaders[0]?.id ?? '');
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported' | 'error'>('loading');
  const activeShader = shaders.find((shader) => shader.id === activeShaderId) ?? shaders[0];

  const [showStats, setShowStats] = useState(false);
  const [gpuInfo, setGpuInfo] = useState<{ vendor: string; architecture: string; device: string }>({
    vendor: '',
    architecture: '',
    device: '',
  });
  const [metrics, setMetrics] = useState({
    fps: 0,
    frameTime: 0,
    history: [] as number[],
  });
  const [currentPresentationSize, setCurrentPresentationSize] = useState({ width: 1, height: 1 });

  const lastTime = useRef(0);
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(0);
  const frameTimesBuffer = useRef<number[]>([]);
  const [showUI, setShowUI] = useState(true);

  useEffect(() => {
    if (!activeShader || !canvasRef.current) return;

    const isInteractiveNetwork = activeShader.kind === 'network';

    let rafId = 0;
    let isDisposed = false;
    let msaaTexture: GPUTexture | null = null;
    let presentationSize = { width: 1, height: 1 };
    let fullscreenPipeline: GPURenderPipeline | null = null;
    let comparisonBasePipeline: GPURenderPipeline | null = null;
    let comparisonMsaaPipeline: GPURenderPipeline | null = null;
    let interactiveUniformBuffer: GPUBuffer | null = null;
    let interactiveBindGroup: GPUBindGroup | null = null;
    let interactiveBindGroupLayout: GPUBindGroupLayout | null = null;
    let interactivePipelineLayout: GPUPipelineLayout | null = null;
    let networkBackgroundPipeline: GPURenderPipeline | null = null;
    let networkEdgesPipeline: GPURenderPipeline | null = null;
    let networkNodesPipeline: GPURenderPipeline | null = null;
    let networkOutlinesPipeline: GPURenderPipeline | null = null;
    let networkEdgeBuffer: GPUBuffer | null = null;
    let networkNodeBuffer: GPUBuffer | null = null;
    let networkOutlineBuffer: GPUBuffer | null = null;
    let context: GPUCanvasContext | null = null;
    let device: GPUDevice | null = null;
    let canvas: HTMLCanvasElement | null = null;
    const startTime = performance.now();
    lastTime.current = startTime;
    lastFpsUpdate.current = startTime;
    let resizeObserver: ResizeObserver | null = null;

    const hoverState = {
      cursor: [...defaultCursorPosition] as [number, number],
      hoveredIndex: -1,
      hoverMix: 0,
      pulseStartTime: 0,
    };

    const syncInteractiveUniforms = (gpuDevice: GPUDevice, elapsed: number) => {
      if (!interactiveUniformBuffer) return;
      writeFullscreenUniforms(gpuDevice, interactiveUniformBuffer, {
        resolution: [presentationSize.width, presentationSize.height],
        cursor: hoverState.cursor,
        metadata: [
          elapsed,
          isInteractiveNetwork ? hoverState.hoveredIndex : -1,
          isInteractiveNetwork ? hoverState.hoverMix : 0,
          isInteractiveNetwork ? hoverState.pulseStartTime : 0,
        ],
      });
    };

    const cleanup = () => {
      isDisposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      if (canvas) {
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerleave', handlePointerLeave);
      }
      msaaTexture?.destroy();
      interactiveUniformBuffer?.destroy();
      networkEdgeBuffer?.destroy();
      networkNodeBuffer?.destroy();
      networkOutlineBuffer?.destroy();
    };

    const configureCanvas = (gpuDevice: GPUDevice, gpuContext: GPUCanvasContext) => {
      if (!canvas) return;

      const dpr =
        activeShader.kind === 'comparison'
          ? window.devicePixelRatio || 1
          : Math.min(window.devicePixelRatio || 1, activeShader.kind === 'network' ? 1 : 1.5);

      const nextWidth = Math.max(
        1,
        Math.min(Math.round(canvas.clientWidth * dpr), gpuDevice.limits.maxTextureDimension2D),
      );
      const nextHeight = Math.max(
        1,
        Math.min(Math.round(canvas.clientHeight * dpr), gpuDevice.limits.maxTextureDimension2D),
      );

      if (
        nextWidth === presentationSize.width &&
        nextHeight === presentationSize.height &&
        (activeShader.kind !== 'comparison' || msaaTexture)
      ) {
        return;
      }

      presentationSize = { width: nextWidth, height: nextHeight };
      setCurrentPresentationSize({ width: nextWidth, height: nextHeight });
      canvas.width = nextWidth;
      canvas.height = nextHeight;

      if (activeShader.kind === 'comparison') {
        msaaTexture?.destroy();
        msaaTexture = gpuDevice.createTexture({
          size: [nextWidth, nextHeight],
          sampleCount: 4,
          format: navigator.gpu.getPreferredCanvasFormat(),
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
      }

      syncInteractiveUniforms(gpuDevice, (performance.now() - startTime) / 1000);

      gpuContext.configure({
        device: gpuDevice,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
      });
    };

    const renderFullscreen = (
      gpuDevice: GPUDevice,
      gpuContext: GPUCanvasContext,
      timeMs: number,
    ) => {
      if (!fullscreenPipeline || !interactiveBindGroup) return;

      syncInteractiveUniforms(gpuDevice, (timeMs - startTime) / 1000);

      const encoder = gpuDevice.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpuContext.getCurrentTexture().createView(),
            clearValue: { r: 0.01, g: 0.03, b: 0.07, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      pass.setPipeline(fullscreenPipeline);
      pass.setBindGroup(0, interactiveBindGroup);
      pass.draw(3);
      pass.end();

      gpuDevice.queue.submit([encoder.finish()]);
    };

    const renderComparison = (gpuDevice: GPUDevice, gpuContext: GPUCanvasContext) => {
      if (!comparisonBasePipeline || !comparisonMsaaPipeline || !msaaTexture) return;

      const canvasView = gpuContext.getCurrentTexture().createView();
      const encoder = gpuDevice.createCommandEncoder();

      const pass1 = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: msaaTexture.createView(),
            resolveTarget: canvasView,
            clearValue: { r: 0.03, g: 0.04, b: 0.06, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'discard',
          },
        ],
      });
      pass1.setPipeline(comparisonMsaaPipeline);
      pass1.draw(3, 1, 6, 0);
      pass1.end();

      const pass2 = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: canvasView,
            loadOp: 'load',
            storeOp: 'store',
          },
        ],
      });
      pass2.setPipeline(comparisonBasePipeline);
      pass2.draw(6, 1, 0, 0);
      pass2.end();

      gpuDevice.queue.submit([encoder.finish()]);
    };

    const renderNetwork = (gpuDevice: GPUDevice, gpuContext: GPUCanvasContext, timeMs: number) => {
      if (
        !networkBackgroundPipeline ||
        !networkOutlinesPipeline ||
        !networkEdgesPipeline ||
        !networkNodesPipeline ||
        !interactiveBindGroup ||
        !networkEdgeBuffer ||
        !networkNodeBuffer ||
        !networkOutlineBuffer
      ) {
        return;
      }

      syncInteractiveUniforms(gpuDevice, (timeMs - startTime) / 1000);

      const encoder = gpuDevice.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpuContext.getCurrentTexture().createView(),
            clearValue: { r: 0.008, g: 0.018, b: 0.03, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      pass.setBindGroup(0, interactiveBindGroup);

      // Disabled to work with nodes in isolation
      // pass.setPipeline(networkBackgroundPipeline);
      // pass.draw(3);

      // pass.setPipeline(networkOutlinesPipeline);
      // pass.setVertexBuffer(0, networkOutlineBuffer);
      // pass.draw(6, airspaceOutlines.length);

      // pass.setPipeline(networkEdgesPipeline);
      // pass.setVertexBuffer(0, networkEdgeBuffer);
      // pass.draw(6, airwayNetworkEdges.length);

      pass.setPipeline(networkNodesPipeline);
      pass.setVertexBuffer(0, networkNodeBuffer);
      pass.draw(6, airwayNetworkNodes.length);

      pass.end();
      gpuDevice.queue.submit([encoder.finish()]);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      hoverState.cursor = [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];

      if (!isInteractiveNetwork) return;

      const nextHoveredIndex = findNearestNetworkNode(hoverState.cursor);
      hoverState.hoverMix = nextHoveredIndex >= 0 ? 1 : 0;

      if (nextHoveredIndex < 0) {
        hoverState.hoveredIndex = -1;
        return;
      }

      if (nextHoveredIndex !== hoverState.hoveredIndex) {
        hoverState.hoveredIndex = nextHoveredIndex;
        hoverState.pulseStartTime = (performance.now() - startTime) / 1000;
      }
    };

    const handlePointerLeave = () => {
      hoverState.hoveredIndex = -1;
      hoverState.hoverMix = 0;
    };

    const frame = (timeMs: number) => {
      if (isDisposed || !device || !context) return;

      const now = performance.now();
      const delta = now - lastTime.current;
      lastTime.current = now;

      frameTimesBuffer.current.push(delta);
      if (frameTimesBuffer.current.length > 60) frameTimesBuffer.current.shift();

      frameCount.current += 1;
      if (now - lastFpsUpdate.current > 500) {
        setMetrics({
          fps: Math.round((frameCount.current * 1000) / (now - lastFpsUpdate.current)),
          frameTime: delta,
          history: [...frameTimesBuffer.current],
        });
        frameCount.current = 0;
        lastFpsUpdate.current = now;
      }

      configureCanvas(device, context);

      if (activeShader.kind === 'comparison') {
        renderComparison(device, context);
      } else if (activeShader.kind === 'fullscreen') {
        renderFullscreen(device, context, timeMs);
      } else {
        renderNetwork(device, context, timeMs);
      }

      rafId = requestAnimationFrame(frame);
    };

    const initWebGPU = async () => {
      try {
        if (!navigator.gpu) {
          setStatus('unsupported');
          return;
        }

        canvas = canvasRef.current;
        if (!canvas) return;

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          setStatus('unsupported');
          return;
        }

        device = await adapter.requestDevice();

        const adapterWithInfo = adapter as GPUAdapter & {
          requestAdapterInfo?: () => Promise<Record<string, string>>;
          info?: GPUAdapterInfo & { description?: string };
        };
        const info =
          typeof adapterWithInfo.requestAdapterInfo === 'function'
            ? await adapterWithInfo.requestAdapterInfo()
            : (adapterWithInfo.info ?? {});

        setGpuInfo({
          vendor: info.vendor === 'apple' ? 'Apple' : (info.vendor ?? 'Unknown Vendor'),
          architecture: info.architecture ?? 'Unknown Arch',
          device:
            info.device ??
            info.description ??
            (info.vendor === 'apple' ? 'Apple Silicon' : 'Unknown GPU'),
        });

        context = canvas.getContext('webgpu');
        if (!context) {
          setStatus('unsupported');
          return;
        }

        if (activeShader.kind !== 'network' && !activeShader.code) {
          setStatus('error');
          return;
        }

        const format = navigator.gpu.getPreferredCanvasFormat();

        if (activeShader.kind === 'comparison') {
          const shaderModule = device.createShaderModule({ code: activeShader.code });
          comparisonBasePipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: { module: shaderModule, entryPoint: 'vs_main' },
            fragment: {
              module: shaderModule,
              entryPoint: 'fs_main',
              targets: [
                {
                  format,
                  blend: {
                    color: {
                      operation: 'add',
                      srcFactor: 'src-alpha',
                      dstFactor: 'one-minus-src-alpha',
                    },
                    alpha: {
                      operation: 'add',
                      srcFactor: 'one',
                      dstFactor: 'one-minus-src-alpha',
                    },
                  },
                },
              ],
            },
            primitive: { topology: 'triangle-list' },
            multisample: { count: 1 },
          });

          comparisonMsaaPipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: { module: shaderModule, entryPoint: 'vs_main' },
            fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format }] },
            primitive: { topology: 'triangle-list' },
            multisample: { count: 4 },
          });
        } else {
          interactiveUniformBuffer = device.createBuffer({
            size: fullscreenUniformByteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          });

          interactiveBindGroupLayout = device.createBindGroupLayout({
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' },
              },
            ],
          });
          interactivePipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [interactiveBindGroupLayout],
          });
          interactiveBindGroup = device.createBindGroup({
            layout: interactiveBindGroupLayout,
            entries: [
              {
                binding: 0,
                resource: { buffer: interactiveUniformBuffer },
              },
            ],
          });

          writeFullscreenUniforms(device, interactiveUniformBuffer, initialUniforms);

          if (activeShader.kind === 'fullscreen') {
            const shaderModule = device.createShaderModule({ code: activeShader.code });
            fullscreenPipeline = device.createRenderPipeline({
              layout: interactivePipelineLayout,
              vertex: { module: shaderModule, entryPoint: 'vs_main' },
              fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format }] },
              primitive: { topology: 'triangle-list' },
            });
          } else {
            const backgroundCode = shaderSources[airwayNetworkBackgroundPath];
            const outlinesCode = shaderSources[airwayNetworkOutlinesPath];
            const edgesCode = shaderSources[airwayNetworkEdgesPath];
            const nodesCode = shaderSources[airwayNetworkNodesPath];

            if (!backgroundCode || !outlinesCode || !edgesCode || !nodesCode) {
              setStatus('error');
              return;
            }

            networkBackgroundPipeline = device.createRenderPipeline({
              layout: interactivePipelineLayout,
              vertex: {
                module: device.createShaderModule({ code: backgroundCode }),
                entryPoint: 'vs_main',
              },
              fragment: {
                module: device.createShaderModule({ code: backgroundCode }),
                entryPoint: 'fs_main',
                targets: [{ format }],
              },
              primitive: { topology: 'triangle-list' },
            });

            networkOutlinesPipeline = device.createRenderPipeline({
              layout: interactivePipelineLayout,
              vertex: {
                module: device.createShaderModule({ code: outlinesCode }),
                entryPoint: 'vs_main',
                buffers: [
                  {
                    arrayStride: 16,
                    stepMode: 'instance',
                    attributes: [
                      { shaderLocation: 0, format: 'float32x2', offset: 0 },
                      { shaderLocation: 1, format: 'float32x2', offset: 8 },
                    ],
                  },
                ],
              },
              fragment: {
                module: device.createShaderModule({ code: outlinesCode }),
                entryPoint: 'fs_main',
                targets: [
                  {
                    format,
                    blend: {
                      color: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
                      alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
                    },
                  },
                ],
              },
              primitive: { topology: 'triangle-list' },
            });

            networkEdgesPipeline = device.createRenderPipeline({
              layout: interactivePipelineLayout,
              vertex: {
                module: device.createShaderModule({ code: edgesCode }),
                entryPoint: 'vs_main',
                buffers: [
                  {
                    arrayStride: 32,
                    stepMode: 'instance',
                    attributes: [
                      { shaderLocation: 0, format: 'float32x2', offset: 0 },
                      { shaderLocation: 1, format: 'float32x2', offset: 8 },
                      { shaderLocation: 2, format: 'float32', offset: 16 },
                      { shaderLocation: 3, format: 'float32', offset: 20 },
                      { shaderLocation: 4, format: 'float32x2', offset: 24 },
                    ],
                  },
                ],
              },
              fragment: {
                module: device.createShaderModule({ code: edgesCode }),
                entryPoint: 'fs_main',
                targets: [
                  {
                    format,
                    blend: {
                      color: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
                      alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
                    },
                  },
                ],
              },
              primitive: { topology: 'triangle-list' },
            });

            networkNodesPipeline = device.createRenderPipeline({
              layout: interactivePipelineLayout,
              vertex: {
                module: device.createShaderModule({ code: nodesCode }),
                entryPoint: 'vs_main',
                buffers: [
                  {
                    arrayStride: 32,
                    stepMode: 'instance',
                    attributes: [
                      { shaderLocation: 0, format: 'float32x2', offset: 0 },
                      { shaderLocation: 1, format: 'float32', offset: 8 },
                      { shaderLocation: 2, format: 'float32', offset: 12 },
                      { shaderLocation: 3, format: 'float32', offset: 16 },
                      { shaderLocation: 4, format: 'float32', offset: 20 },
                    ],
                  },
                ],
              },
              fragment: {
                module: device.createShaderModule({ code: nodesCode }),
                entryPoint: 'fs_main',
                targets: [
                  {
                    format,
                    blend: {
                      color: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
                      alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
                    },
                  },
                ],
              },
              primitive: { topology: 'triangle-list' },
            });

            networkEdgeBuffer = createStaticBuffer(
              device,
              buildNetworkEdgeInstanceData(airwayNetworkNodes, airwayNetworkEdges),
              GPUBufferUsage.VERTEX,
            );
            networkNodeBuffer = createStaticBuffer(
              device,
              buildNetworkNodeInstanceData(airwayNetworkNodes),
              GPUBufferUsage.VERTEX,
            );
            networkOutlineBuffer = createStaticBuffer(
              device,
              buildNetworkOutlineInstanceData(airspaceOutlines),
              GPUBufferUsage.VERTEX,
            );
          }

          canvas.addEventListener('pointermove', handlePointerMove);
          canvas.addEventListener('pointerleave', handlePointerLeave);
        }

        configureCanvas(device, context);
        resizeObserver = new ResizeObserver(() => {
          if (!device || !context) return;
          configureCanvas(device, context);
        });
        resizeObserver.observe(canvas);

        setStatus('ready');
        rafId = requestAnimationFrame(frame);
      } catch (error) {
        console.error('ShaderLab initialization failed.', error);
        setStatus('error');
      }
    };

    setStatus('loading');
    void initWebGPU();

    return cleanup;
  }, [activeShader]);

  if (!activeShader) {
    return null;
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#020611] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.1),_transparent_30%),linear-gradient(180deg,_#020611_0%,_#050b14_48%,_#020611_100%)]" />
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.08]" />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div
            className={`pointer-events-auto max-w-lg rounded-3xl border border-white/8 bg-black/40 p-4 backdrop-blur-3xl shadow-2xl transition-all duration-500 ${showUI ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'}`}
          >
            {showUI && (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="mb-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/40 transition hover:text-white/80"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Return
                </button>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div
                    className={`h-9 w-9 rounded-xl bg-gradient-to-br ${activeShader.accent} shadow-lg`}
                  />
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.24em] text-white/35">
                      ShaderLab / WGSL
                    </p>
                    <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                      {activeShader.label}
                    </h1>
                  </div>
                </div>
                <p className="text-xs leading-5 text-white/60 md:text-sm">{activeShader.summary}</p>
                <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-white/40 md:text-xs">
                  {activeShader.detail}
                </p>
                {activeShader.interactionHint ? (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/15 bg-cyan-400/5 px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-cyan-200/70">
                    <MousePointer2 className="h-3 w-3" />
                    {activeShader.interactionHint}
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => setShowUI(!showUI)}
                className={`flex items-center justify-center h-10 w-10 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl transition-all hover:bg-white/5 active:scale-95 ${!showUI ? 'text-cyan-400 ring-2 ring-cyan-500/20' : 'text-white/40'}`}
                title={showUI ? 'Hide Interface' : 'Show Interface'}
              >
                {showUI ? <Layout className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setShowStats(!showStats)}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3.5 py-2 backdrop-blur-2xl transition hover:bg-white/5 active:scale-95"
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/60">
                  <Cpu className="h-3.5 w-3.5" />
                  {status === 'ready' ? (
                    <span className="flex items-center gap-1.5">
                      WebGPU{' '}
                      <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    </span>
                  ) : (
                    'Status: ' + status
                  )}
                </div>
                <Activity
                  className={`h-3.5 w-3.5 transition-colors ${
                    showStats ? 'text-cyan-400' : 'text-white/30'
                  }`}
                />
              </button>
            </div>

            {showStats ? (
              <div className="pointer-events-auto w-64 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-3xl shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Workload Monitor
                  </div>
                  <button
                    onClick={() => setShowStats(false)}
                    className="text-white/20 transition hover:text-white/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                      FPS
                    </p>
                    <p className="font-mono text-xl font-bold text-emerald-400">{metrics.fps}</p>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                      Latency
                    </p>
                    <p className="font-mono text-xl font-bold text-cyan-400">
                      {metrics.frameTime.toFixed(1)}
                      <span className="ml-0.5 text-[10px] opacity-50">ms</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex h-12 items-end gap-[1px]">
                  {metrics.history.map((frameTime, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-t-[1px] bg-cyan-500/30"
                      style={{ height: `${Math.min(100, (frameTime / 33) * 100)}%` }}
                    />
                  ))}
                </div>

                <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                      GPU
                    </span>
                    <span className="max-w-[140px] truncate font-mono text-[10px] text-white/70">
                      {gpuInfo.device}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                      Arch
                    </span>
                    <span className="font-mono text-[10px] text-white/70">
                      {gpuInfo.architecture}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                      View
                    </span>
                    <span className="font-mono text-[10px] text-white/70">
                      {currentPresentationSize.width}x{currentPresentationSize.height}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={`flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between transition-all duration-500 ${showUI ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
        >
          {showUI && (
            <>
              <div className="pointer-events-auto max-w-5xl rounded-3xl border border-white/8 bg-black/40 p-3 backdrop-blur-3xl shadow-2xl overflow-hidden">
                <div className="mb-3 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                  <Library className="h-3 w-3" />
                  Shader Library
                </div>

                <div className="flex flex-col gap-6 max-h-[40vh] overflow-y-auto px-1 custom-scrollbar">
                  {(['Airway Network', 'Examples', 'Lab'] as const).map((category) => {
                    const categoryShaders = shaders.filter((s) => s.category === category);
                    if (categoryShaders.length === 0) return null;

                    return (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center gap-2 px-2">
                          {category === 'Airway Network' && (
                            <Layers className="h-3 w-3 text-sky-400/60" />
                          )}
                          {category === 'Examples' && (
                            <Waves className="h-3 w-3 text-emerald-400/60" />
                          )}
                          {category === 'Lab' && (
                            <FlaskConical className="h-3 w-3 text-orange-400/60" />
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">
                            {category}
                          </span>
                          <div className="h-px flex-1 bg-white/5" />
                        </div>

                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          {categoryShaders.map((shader) => {
                            const isActive = shader.id === activeShader.id;
                            return (
                              <button
                                key={shader.id}
                                type="button"
                                onClick={() => setActiveShaderId(shader.id)}
                                className={`group rounded-2xl border px-3.5 py-3 text-left transition ${
                                  isActive
                                    ? 'border-white/20 bg-white/10 shadow-lg'
                                    : 'border-white/5 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.05]'
                                }`}
                              >
                                <div
                                  className={`mb-2.5 h-1 w-12 origin-left rounded-full bg-gradient-to-r ${shader.accent} transition-transform group-hover:scale-x-110`}
                                />
                                <div className="text-[13px] font-bold tracking-tight text-white/90">
                                  {shader.label}
                                </div>
                                <div className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-white/40 transition-colors group-hover:text-white/60">
                                  {shader.summary}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {shader.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded-full border border-white/5 bg-white/[0.03] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/30"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pointer-events-auto rounded-3xl border border-white/8 bg-black/40 p-4 backdrop-blur-3xl shadow-2xl lg:max-w-[280px]">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                  <Clock3 className="h-3 w-3" />
                  Source
                </div>
                <p className="truncate font-mono text-[10px] text-cyan-300/60">
                  {activeShader.sourceLabel ?? activeShader.shaderPath}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-white/35">
                  Fullscreen presets share cursor and timing uniforms via bind groups.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {status === 'unsupported' ? (
        <div className="absolute bottom-5 inset-x-5 rounded-[24px] border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100 backdrop-blur-xl md:bottom-8 md:right-8 md:left-auto md:w-[28rem]">
          This browser does not expose WebGPU on April 29, 2026. Use a recent Chromium-based build
          with WebGPU enabled.
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="absolute bottom-5 inset-x-5 rounded-[24px] border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100 backdrop-blur-xl md:bottom-8 md:right-8 md:left-auto md:w-[28rem]">
          Shader initialization failed. Check the browser console for WGSL compilation details.
        </div>
      ) : null}
    </div>
  );
}
