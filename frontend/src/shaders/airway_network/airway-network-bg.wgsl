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
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -3.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 3.0,  1.0)
    );

    let clip = positions[vertex_index];
    var out: VertexOutput;
    out.position = vec4<f32>(clip, 0.0, 1.0);
    out.uv = clip * 0.5 + vec2<f32>(0.5, 0.5);
    return out;
}

fn aspectify(point: vec2<f32>, aspect: f32) -> vec2<f32> {
    return (point - 0.5) * vec2<f32>(aspect, 1.0);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let time = uniforms.metadata.x;
    let aspect = uniforms.resolution.x / max(uniforms.resolution.y, 1.0);
    let world = aspectify(in.uv, aspect);
    let radial = length(world);
    let sweep = 0.5 + 0.5 * sin((world.x + world.y) * 4.0 + time * 0.35);
    let scan = 0.92 + 0.08 * sin(in.uv.y * uniforms.resolution.y * 0.24 + time * 2.0);
    let vignette = smoothstep(1.55, 0.18, radial);

    var color = vec3<f32>(0.008, 0.018, 0.03);
    color += vec3<f32>(0.01, 0.04, 0.055) * sweep * 0.22;
    color += vec3<f32>(0.008, 0.02, 0.03) * scan * 0.08;
    color *= vignette;

    return vec4<f32>(color, 1.0);
}
