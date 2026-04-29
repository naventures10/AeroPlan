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

fn hash21(p: vec2<f32>) -> f32 {
    let h = dot(p, vec2<f32>(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
}

fn noise2(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);

    let a = hash21(i);
    let b = hash21(i + vec2<f32>(1.0, 0.0));
    let c = hash21(i + vec2<f32>(0.0, 1.0));
    let d = hash21(i + vec2<f32>(1.0, 1.0));

    let x1 = mix(a, b, u.x);
    let x2 = mix(c, d, u.x);
    return mix(x1, x2, u.y);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let time = uniforms.metadata.x;
    let aspect = uniforms.resolution.x / max(uniforms.resolution.y, 1.0);
    let uv = (in.uv - 0.5) * vec2<f32>(aspect, 1.0);
    let t = time * 0.35;

    let warp = vec2<f32>(
        noise2(uv * 2.5 + vec2<f32>(t * 1.2, -t * 0.8)),
        noise2(uv * 2.5 + vec2<f32>(-t * 0.9, t * 1.4))
    ) - 0.5;

    let pulse = sin((uv.y + warp.x * 0.35) * 18.0 - t * 11.0);
    let arc = sin(length(uv + warp * 0.25) * 24.0 - t * 8.0);
    let field = noise2(uv * 6.0 + warp * 2.5 + vec2<f32>(0.0, t * 2.0));

    let energy = smoothstep(0.1, 0.95, 0.45 * pulse + 0.35 * arc + 0.8 * field);
    let scan = 0.92 + 0.08 * sin(in.uv.y * uniforms.resolution.y * 0.9);
    let vignette = smoothstep(1.25, 0.08, length(uv));

    let base = vec3<f32>(0.02, 0.06, 0.12);
    let cyan = vec3<f32>(0.07, 0.78, 0.95);
    let blue = vec3<f32>(0.16, 0.38, 1.0);
    let white = vec3<f32>(0.95, 0.99, 1.0);

    var color = mix(base, cyan, energy * 0.65);
    color = mix(color, blue, smoothstep(0.3, 1.0, field));
    color += white * pow(energy, 4.0) * 0.35;
    color *= scan * vignette;

    return vec4<f32>(color, 1.0);
}
