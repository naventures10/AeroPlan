struct ShaderUniforms {
    resolution: vec2<f32>,
    cursor: vec2<f32>,
    metadata: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: ShaderUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    let pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );
    var out: VertexOutput;
    out.position = vec4<f32>(pos[vertex_index], 0.0, 1.0);
    out.uv = pos[vertex_index] * 0.5 + 0.5;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    let uv = (in.uv * 2.0 - 1.0) * vec2<f32>(aspect, 1.0);
    let time = uniforms.metadata.x;
    
    let sf = 2.0 / min(uniforms.resolution.x, uniforms.resolution.y);
    
    // Grid math
    let grid_size = 0.2;
    let grid_line = 0.002;
    
    let g = fract(uv / grid_size + 0.5) - 0.5;
    let dist = abs(g) * grid_size;
    let grid = smoothstep(grid_line + sf, grid_line, min(dist.x, dist.y));
    
    // Circular vignette
    let l = length(uv);
    let vignette = smoothstep(1.2, 0.4, l);
    
    // Pulse
    let pulse = 0.5 + 0.5 * sin(time * 2.0 - l * 4.0);
    
    let base_color = vec3<f32>(0.02, 0.05, 0.1);
    let grid_color = vec3<f32>(0.0, 0.4, 0.8) * grid * pulse;
    
    let final_color = mix(base_color, grid_color, grid);
    return vec4<f32>(final_color * vignette, 1.0);
}
