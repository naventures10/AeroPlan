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

const PI: f32 = 3.14159265359;
const TWO_PI: f32 = 6.28318530718;

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

fn radar_sweep(uv: vec2<f32>, center: vec2<f32>, radius: f32, speed: f32, time: f32, tail_length: f32) -> f32 {
    let d = uv - center;
    let dist = length(d);
    
    if (dist > radius) { return 0.0; }
    
    let angle = atan2(d.y, d.x);
    let sweep_angle = (time * speed) % TWO_PI;
    
    var diff = sweep_angle - angle;
    if (diff < 0.0) { diff += TWO_PI; }
    
    return clamp(1.0 - diff / tail_length, 0.0, 1.0);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    let uv = (in.uv * 2.0 - 1.0) * vec2<f32>(aspect, 1.0);
    let time = uniforms.metadata.x;

    let green = vec3<f32>(0.0, 1.0, 0.2);
    let red = vec3<f32>(1.0, 0.1, 0.1);
    
    let s1 = radar_sweep(uv, vec2<f32>(-0.5, 0.0), 0.8, 1.5, time, PI * 0.5);
    let s2 = radar_sweep(uv, vec2<f32>( 0.5, 0.0), 0.8, -1.2, time, PI * 0.5);
    
    let color = green * s1 + red * s2;
    let grid = step(0.98, fract(uv.x * 10.0)) + step(0.98, fract(uv.y * 10.0));
    
    return vec4<f32>(color + grid * 0.05, 1.0);
}
