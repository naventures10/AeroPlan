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

fn hsb2rgb(c: vec3<f32>) -> vec3<f32> {
    var rgb = clamp(abs(((c.x * 6.0 + vec3<f32>(0.0, 4.0, 2.0)) % 6.0) - 3.0) - 1.0, vec3<f32>(0.0), vec3<f32>(1.0));
    rgb = rgb * rgb * (3.0 - 2.0 * rgb);
    return c.z * mix(vec3<f32>(1.0), rgb, c.y);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    let uv = (in.uv * 2.0 - 1.0) * vec2<f32>(aspect, 1.0);
    let time = uniforms.metadata.x;
    
    let r = length(uv) * 0.9;
    let angle = (atan2(uv.y, uv.x) + PI) / (2.0 * PI);
    
    // Animate color based on time and radius
    let h = (angle + time * 0.1) % 1.0;
    let s = 0.7;
    let b = smoothstep(0.8, 0.0, r);
    
    let color = hsb2rgb(vec3<f32>(h, s, 0.5));
    
    // interference pattern
    let pattern = sin(r * 20.0 - time * 5.0 + sin(angle * 10.0));
    let final_color = color * abs(1.0 / (pattern * 10.0));
    
    return vec4<f32>(final_color, 1.0);
}

const PI: f32 = 3.14159265359;
