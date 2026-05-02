import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type {
  LoadedShaderDefinition,
  GPUInfo,
  GPUMetrics,
  PresentationSize,
  NdbIconConfig,
  NetworkNode,
} from '../types';
import {
  defaultCursorPosition,
  fullscreenUniformByteLength,
  shaderSources,
  airwayNetworkBackgroundPath,
  airwayNetworkNodesPath,
} from '../constants';
import { writeFullscreenUniforms } from '../utils/gpu-utils';

export function useWebGPU(
  activeShader: LoadedShaderDefinition,
  ndbIconConfigRef: MutableRefObject<NdbIconConfig>,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported' | 'error'>('loading');
  const [gpuInfo, setGpuInfo] = useState<GPUInfo>({ vendor: '', architecture: '', device: '' });
  const [metrics, setMetrics] = useState<GPUMetrics>({ fps: 0, frameTime: 0, history: [] });
  const [currentPresentationSize, setCurrentPresentationSize] = useState<PresentationSize>({
    width: 1,
    height: 1,
  });

  const lastTime = useRef(0);
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(0);
  const frameTimesBuffer = useRef<number[]>([]);
  const binaryNodes = useRef<NetworkNode[]>([]);

  useEffect(() => {
    if (!activeShader || !canvasRef.current) return;

    let rafId = 0;
    let isDisposed = false;
    let device: GPUDevice | null = null;
    let context: GPUCanvasContext | null = null;
    let msaaTexture: GPUTexture | null = null;
    let presentationSize = { width: 1, height: 1 };

    // Pipelines
    let fullscreenPipeline: GPURenderPipeline | null = null;
    let comparisonBasePipeline: GPURenderPipeline | null = null;
    let comparisonMsaaPipeline: GPURenderPipeline | null = null;
    let networkBackgroundPipeline: GPURenderPipeline | null = null;
    let networkNodesPipeline: GPURenderPipeline | null = null;

    // Buffers & Layouts
    let uniformBuffer: GPUBuffer | null = null;
    let nodeBuffer: GPUBuffer | null = null;
    let bindGroup: GPUBindGroup | null = null;
    let pipelineLayout: GPUPipelineLayout | null = null;

    const hoverState = {
      cursor: [...defaultCursorPosition] as [number, number],
      hoveredIndex: -1,
      hoverMix: 0,
      pulseStartTime: 0,
    };

    const startTime = performance.now();
    lastTime.current = startTime;
    lastFpsUpdate.current = startTime;

    const updateUniforms = (gpuDevice: GPUDevice, elapsed: number) => {
      if (!uniformBuffer) return;

      let metadata: [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ] = [elapsed, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      if (activeShader.category === 'Lab') {
        metadata = [
          elapsed,
          ndbIconConfigRef.current.ringCount,
          ndbIconConfigRef.current.ringSpacing,
          ndbIconConfigRef.current.rotation,
          ndbIconConfigRef.current.dotDensity,
          ndbIconConfigRef.current.circleRadius,
          ndbIconConfigRef.current.lineLength,
          ndbIconConfigRef.current.tickCount,
          ndbIconConfigRef.current.tickLength,
          0,
          0,
          0,
        ];
      } else if (activeShader.kind === 'network') {
        metadata = [
          elapsed,
          hoverState.hoveredIndex,
          hoverState.hoverMix,
          hoverState.pulseStartTime,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ];
      }

      writeFullscreenUniforms(gpuDevice, uniformBuffer, {
        resolution: [presentationSize.width, presentationSize.height],
        cursor: hoverState.cursor,
        metadata,
      });
    };

    const configureCanvas = (gpuDevice: GPUDevice) => {
      const canvas = canvasRef.current;
      if (!canvas || !context) return;

      const dpr =
        activeShader.kind === 'comparison'
          ? window.devicePixelRatio || 1
          : Math.min(window.devicePixelRatio || 1, 1.5);

      const nextWidth = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const nextHeight = Math.max(1, Math.round(canvas.clientHeight * dpr));

      if (
        nextWidth === presentationSize.width &&
        nextHeight === presentationSize.height &&
        (activeShader.kind !== 'comparison' || msaaTexture)
      )
        return;

      presentationSize = { width: nextWidth, height: nextHeight };
      setCurrentPresentationSize(presentationSize);
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

      context.configure({
        device: gpuDevice,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
      });
    };

    const render = () => {
      if (isDisposed || !device || !context) return;

      const now = performance.now();
      const delta = now - lastTime.current;
      lastTime.current = now;

      frameTimesBuffer.current.push(delta);
      if (frameTimesBuffer.current.length > 60) frameTimesBuffer.current.shift();

      if (now - lastFpsUpdate.current > 500) {
        setMetrics({
          fps: Math.round((frameCount.current * 1000) / (now - lastFpsUpdate.current)),
          frameTime:
            frameTimesBuffer.current.reduce((a, b) => a + b, 0) / frameTimesBuffer.current.length,
          history: [...frameTimesBuffer.current],
        });
        frameCount.current = 0;
        lastFpsUpdate.current = now;
      }
      frameCount.current++;

      configureCanvas(device);
      updateUniforms(device, (now - startTime) / 1000);

      const commandEncoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();

      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          activeShader.kind === 'comparison'
            ? {
                // In comparison mode, we'll use this pass for the MSAA side
                view: msaaTexture!.createView(),
                resolveTarget: textureView,
                clearValue: { r: 0.01, g: 0.02, b: 0.05, a: 1.0 },
                loadOp: 'clear' as GPULoadOp,
                storeOp: 'store' as GPUStoreOp,
              }
            : {
                view: textureView,
                clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                loadOp: 'clear' as GPULoadOp,
                storeOp: 'store' as GPUStoreOp,
              },
        ],
      };

      if (activeShader.kind === 'fullscreen' && fullscreenPipeline) {
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(fullscreenPipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(3);
        passEncoder.end();
      } else if (
        activeShader.kind === 'comparison' &&
        comparisonBasePipeline &&
        comparisonMsaaPipeline
      ) {
        // Pass 1: MSAA Side (Right Half)
        // This pass clears the canvas and resolves its results to the right half
        const msaaPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        msaaPass.setBindGroup(0, bindGroup);
        msaaPass.setPipeline(comparisonMsaaPipeline);
        msaaPass.setViewport(
          presentationSize.width / 2,
          0,
          presentationSize.width / 2,
          presentationSize.height,
          0,
          1,
        );
        msaaPass.draw(9);
        msaaPass.end();

        // Pass 2: Base Side (Left Half)
        // This pass loads the existing canvas (with the resolved MSAA right half) and draws to the left half
        const basePass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: textureView,
              loadOp: 'load' as GPULoadOp,
              storeOp: 'store' as GPUStoreOp,
            },
          ],
        });
        basePass.setBindGroup(0, bindGroup);
        basePass.setPipeline(comparisonBasePipeline);
        basePass.setViewport(0, 0, presentationSize.width / 2, presentationSize.height, 0, 1);
        basePass.draw(9);
        basePass.end();
      } else if (
        activeShader.kind === 'network' &&
        networkBackgroundPipeline &&
        networkNodesPipeline &&
        nodeBuffer
      ) {
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(networkBackgroundPipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(3);
        passEncoder.setPipeline(networkNodesPipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.setVertexBuffer(0, nodeBuffer);
        passEncoder.draw(6, binaryNodes.current.length);
        passEncoder.end();
      }

      device.queue.submit([commandEncoder.finish()]);

      if (activeShader.kind === 'network') {
        const nearestIndex = findNearestNode(hoverState.cursor);
        if (nearestIndex !== hoverState.hoveredIndex) {
          hoverState.hoveredIndex = nearestIndex;
          hoverState.hoverMix = 0;
          if (nearestIndex !== -1) hoverState.pulseStartTime = (now - startTime) / 1000;
        }
        if (hoverState.hoveredIndex !== -1) {
          hoverState.hoverMix = Math.min(1, hoverState.hoverMix + delta / 200);
        } else {
          hoverState.hoverMix = Math.max(0, hoverState.hoverMix - delta / 300);
        }
      }

      rafId = requestAnimationFrame(render);
    };

    const findNearestNode = (cursor: [number, number]) => {
      let nearestIndex = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      binaryNodes.current.forEach((node, index) => {
        const dx = cursor[0] - node.position[0];
        const dy = cursor[1] - node.position[1];
        const distance = Math.hypot(dx, dy);
        const hoverRadius = node.hoverRadius || 0.05;
        if (distance <= hoverRadius && distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      return nearestIndex;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      hoverState.cursor = [x, 1.0 - y];
    };

    const init = async () => {
      try {
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) return setStatus('unsupported');
        device = await adapter.requestDevice();
        context = canvasRef.current!.getContext('webgpu');
        if (!context) return setStatus('unsupported');

        // Handle different versions of the WebGPU spec for adapter info
        let info: { vendor: string; architecture: string; device: string };
        if ('info' in adapter) {
          info = (adapter as any).info;
        } else if ('requestAdapterInfo' in adapter) {
          info = await (adapter as any).requestAdapterInfo();
        } else {
          info = { vendor: 'Unknown', architecture: 'Unknown', device: 'WebGPU Device' };
        }
        setGpuInfo({ vendor: info.vendor, architecture: info.architecture, device: info.device });

        // 1. Create a single Bind Group Layout that all pipelines will share
        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
              buffer: { type: 'uniform' },
            },
          ],
        });

        // 2. Create an explicit Pipeline Layout
        pipelineLayout = device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        });

        uniformBuffer = device.createBuffer({
          size: fullscreenUniformByteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        });

        const shaderModule = device.createShaderModule({ code: activeShader.code });

        if (activeShader.kind === 'fullscreen') {
          fullscreenPipeline = await device.createRenderPipelineAsync({
            layout: pipelineLayout,
            vertex: { module: shaderModule, entryPoint: 'vs_main' },
            fragment: {
              module: shaderModule,
              entryPoint: 'fs_main',
              targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
            },
            primitive: { topology: 'triangle-list' },
          });
        } else if (activeShader.kind === 'comparison') {
          comparisonBasePipeline = await device.createRenderPipelineAsync({
            layout: pipelineLayout,
            vertex: { module: shaderModule, entryPoint: 'vs_main' },
            fragment: {
              module: shaderModule,
              entryPoint: 'fs_main',
              targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
            },
            primitive: { topology: 'triangle-list' },
          });
          comparisonMsaaPipeline = await device.createRenderPipelineAsync({
            layout: pipelineLayout,
            vertex: { module: shaderModule, entryPoint: 'vs_main' },
            fragment: {
              module: shaderModule,
              entryPoint: 'fs_main',
              targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
            },
            primitive: { topology: 'triangle-list' },
            multisample: { count: 4 },
          });
        } else if (activeShader.kind === 'network') {
          const nodesRes = await fetch('/data/nav_aids_meta.json');
          const meta = await nodesRes.json();
          const binRes = await fetch('/data/nav_aids.bin');
          const binData = await binRes.arrayBuffer();
          const nodeData = new Float32Array(binData);

          nodeBuffer = device.createBuffer({
            size: nodeData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
          });
          new Float32Array(nodeBuffer.getMappedRange()).set(nodeData);
          nodeBuffer.unmap();

          const nodes: NetworkNode[] = [];
          for (let i = 0; i < meta.count; i++) {
            nodes.push({
              position: [nodeData[i * 4 + 0] ?? 0, nodeData[i * 4 + 1] ?? 0],
              size: nodeData[i * 4 + 2] ?? 0,
              nodeType: nodeData[i * 4 + 3] ?? 0,
              frequencyNorm: nodeData[i * 4 + 3] ?? 0,
              hoverRadius: 0.02,
            });
          }
          binaryNodes.current = nodes;

          const bgCode = shaderSources[airwayNetworkBackgroundPath];
          const nodesCode = shaderSources[airwayNetworkNodesPath];

          if (!bgCode || !nodesCode) {
            throw new Error('Failed to load airway network shaders');
          }

          const bgModule = device.createShaderModule({ code: bgCode });
          const nodesModule = device.createShaderModule({ code: nodesCode });

          networkBackgroundPipeline = await device.createRenderPipelineAsync({
            layout: pipelineLayout,
            vertex: { module: bgModule, entryPoint: 'vs_main' },
            fragment: {
              module: bgModule,
              entryPoint: 'fs_main',
              targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
            },
          });

          networkNodesPipeline = await device.createRenderPipelineAsync({
            layout: pipelineLayout,
            vertex: {
              module: nodesModule,
              entryPoint: 'vs_main',
              buffers: [
                {
                  arrayStride: 16,
                  stepMode: 'instance',
                  attributes: [
                    { format: 'float32x2', offset: 0, shaderLocation: 0 },
                    { format: 'float32', offset: 8, shaderLocation: 1 },
                    { format: 'float32', offset: 12, shaderLocation: 2 },
                  ],
                },
              ],
            },
            fragment: {
              module: nodesModule,
              entryPoint: 'fs_main',
              targets: [
                {
                  format: navigator.gpu.getPreferredCanvasFormat(),
                  blend: {
                    color: {
                      srcFactor: 'src-alpha',
                      dstFactor: 'one-minus-src-alpha',
                      operation: 'add',
                    },
                    alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
                  },
                },
              ],
            },
          });
        }

        canvasRef.current!.addEventListener('pointermove', handlePointerMove);
        setStatus('ready');
        rafId = requestAnimationFrame(render);
      } catch (e) {
        console.error(e);
        setStatus('error');
      }
    };

    init();
    const canvas = canvasRef.current;
    return () => {
      isDisposed = true;
      cancelAnimationFrame(rafId);
      canvas?.removeEventListener('pointermove', handlePointerMove);
      msaaTexture?.destroy();
      uniformBuffer?.destroy();
      nodeBuffer?.destroy();
    };
  }, [activeShader, ndbIconConfigRef]);

  return { canvasRef, status, gpuInfo, metrics, currentPresentationSize };
}
