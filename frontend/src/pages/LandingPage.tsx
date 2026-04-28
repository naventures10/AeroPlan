import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import shaderSource from '../../../shaders/triangle.wgsl?raw';

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const initWebGPU = async () => {
      if (!navigator.gpu || !canvasRef.current) {
        console.error('WebGPU is not supported on this browser.');
        return;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.error('No appropriate GPUAdapter found.');
        return;
      }

      const device = await adapter.requestDevice();
      const canvas = canvasRef.current;
      const context = canvas.getContext('webgpu');

      if (!context) {
        console.error('WebGPU context could not be initialized.');
        return;
      }

      const canvasConfig: GPUCanvasConfiguration = {
        device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
      };
      context.configure(canvasConfig);

      const shaderModule = device.createShaderModule({
        code: shaderSource,
      });

      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{ format: canvasConfig.format }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      const render = () => {
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPassDescriptor: GPURenderPassDescriptor = {
          colorAttachments: [
            {
              view: textureView,
              clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.draw(3);
        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
      };

      // Resize handler
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
          const height = entry.contentBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
          canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
          canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
        }
      });
      observer.observe(canvas);

      render();

      return () => observer.disconnect();
    };

    initWebGPU();
  }, []);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
      {/* WebGPU Canvas */}
      <canvas ref={canvasRef} id="webgpu-canvas" className="absolute inset-0 w-full h-full z-0" />

      {/* Hero Content Overlay */}
      <div className="relative z-10 flex flex-col items-center text-center px-4">
        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 tracking-tighter mb-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          AERO PLAN
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
          Next-generation flight planning powered by high-performance graphics.
        </p>

        <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
          <Link
            to="/app"
            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-all active:scale-95 flex items-center gap-2 group"
          >
            Launch Map
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="group-hover:translate-x-1 transition-transform"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Decorative glass elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
