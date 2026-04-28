import { useEffect, useRef } from 'react';
import shaderSource from '../shaders/triangle.wgsl?raw';

/**
 * WebGPU Anti-Aliasing Comparison Lab
 * 1. Left: No Anti-Aliasing (Jagged)
 * 2. Center: Shader-based Anti-Aliasing (Smooth via Smoothstep/Barycentrics)
 * 3. Right: Hardware MSAA (Smooth via 4x Multisampling)
 */
export default function ShaderLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const initWebGPU = async () => {
      if (!navigator.gpu || !canvasRef.current) {
        console.error('WebGPU is not supported on this browser.');
        return;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return;

      const device = await adapter.requestDevice();
      const canvas = canvasRef.current;
      const context = canvas.getContext('webgpu');
      if (!context) return;

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: 'premultiplied',
      });

      const shaderModule = device.createShaderModule({ code: shaderSource });

      // Pipeline 1: Standard (1 Sample) for Triangle 1 & 2
      const basePipeline = device.createRenderPipeline({
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
                alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
              },
            },
          ],
        },
        primitive: { topology: 'triangle-list' },
        multisample: { count: 1 },
      });

      // Pipeline 2: Hardware MSAA (4 Samples) for Triangle 3
      const msaaPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vs_main' },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{ format }],
        },
        primitive: { topology: 'triangle-list' },
        multisample: { count: 4 },
      });

      let msaaTexture: GPUTexture | null = null;
      let rafId: number;

      const render = () => {
        if (!context || !canvas) return;

        const commandEncoder = device.createCommandEncoder();
        const canvasTexture = context.getCurrentTexture();
        const canvasView = canvasTexture.createView();

        // --- PASS 1: Hardware MSAA Rendering (Triangle 3) ---
        // Render to the MSAA texture and resolve to the canvas view.
        if (msaaTexture) {
          const pass1 = commandEncoder.beginRenderPass({
            colorAttachments: [
              {
                view: msaaTexture.createView(),
                resolveTarget: canvasView,
                clearValue: { r: 0.05, g: 0.05, b: 0.05, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'discard',
              },
            ],
          });
          pass1.setPipeline(msaaPipeline);
          pass1.draw(3, 1, 6, 0); // Triangle 3 (Right)
          pass1.end();
        }

        // --- PASS 2: Standard Rendering (Triangle 1 & 2) ---
        // Draw on top of the resolved canvas.
        const pass2 = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: canvasView,
              loadOp: 'load', // Keep the MSAA triangle
              storeOp: 'store',
            },
          ],
        });
        pass2.setPipeline(basePipeline);
        pass2.draw(6, 1, 0, 0); // Triangle 1 (Left) & 2 (Center)
        pass2.end();

        device.queue.submit([commandEncoder.finish()]);
        rafId = requestAnimationFrame(render);
      };

      const handleResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
        canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));

        // Recreate MSAA texture on resize
        if (msaaTexture) msaaTexture.destroy();
        msaaTexture = device.createTexture({
          size: [canvas.width, canvas.height],
          sampleCount: 4,
          format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
      };

      window.addEventListener('resize', handleResize);
      handleResize();
      render();

      return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(rafId);
        msaaTexture?.destroy();
      };
    };

    const cleanupPromise = initWebGPU();
    return () => {
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-[#0d0d0d] overflow-hidden font-sans">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Overlay Labels */}
      <div className="absolute inset-x-0 bottom-12 flex justify-around pointer-events-none text-white/50 text-sm font-medium tracking-widest uppercase">
        <div className="flex flex-col items-center gap-2">
          <span className="text-orange-500/50">01</span>
          <span>No Anti-Aliasing</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-orange-500/50">02</span>
          <span>Shader (Barycentric)</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-orange-500/50">03</span>
          <span>Hardware MSAA 4x</span>
        </div>
      </div>

      <div className="absolute top-8 left-8">
        <h1 className="text-white text-xl font-bold tracking-tight">
          WEB<span className="text-orange-500">GPU</span> SHADER LAB
        </h1>
        <p className="text-white/30 text-xs mt-1 uppercase tracking-tighter">
          Comparison: Geometric vs Procedural vs Hardware AA
        </p>
      </div>
    </div>
  );
}
