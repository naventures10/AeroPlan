import type { FullscreenUniforms } from '../types';

export function writeFullscreenUniforms(
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
    uniforms.metadata[4],
    uniforms.metadata[5],
    uniforms.metadata[6],
    uniforms.metadata[7],
    uniforms.metadata[8],
    uniforms.metadata[9],
    uniforms.metadata[10],
    uniforms.metadata[11],
  ]);
  device.queue.writeBuffer(buffer, 0, data);
}
