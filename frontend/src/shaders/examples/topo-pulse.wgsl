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
    let h = dot(p, vec2<f32>(41.0, 289.0));
    return fract(sin(h) * 27358.5453);
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
    let centered = (in.uv - 0.5) * vec2<f32>(aspect, 1.0) * 2.0;
    let t = time * 0.22;

    let drift = vec2<f32>(
        noise2(centered * 1.7 + vec2<f32>(t, -t * 0.7)),
        noise2(centered * 1.7 + vec2<f32>(-t * 0.5, t * 1.1))
    ) - 0.5;

    let distanceField = length(centered + drift * 0.8);
    let ripple = sin(distanceField * 19.0 - time * 3.0);
    let contour = abs(fract(distanceField * 6.0 - time * 0.28) - 0.5);
    let terrain = noise2(centered * 3.5 + drift * 2.0 + vec2<f32>(t * 0.2, -t * 0.35));
    let bands = smoothstep(0.18, 0.0, contour);
    let glow = smoothstep(0.25, 0.95, 0.55 * terrain + 0.45 * ripple);
    let grid = 1.0 - smoothstep(0.0, 0.018, abs(fract((centered.x + centered.y) * 5.0) - 0.5));

    let deep = vec3<f32>(0.03, 0.05, 0.08);
    let moss = vec3<f32>(0.15, 0.48, 0.35);
    let lime = vec3<f32>(0.74, 0.97, 0.52);
    let mist = vec3<f32>(0.92, 1.0, 0.95);

    var color = mix(deep, moss, terrain * 0.8);
    color = mix(color, lime, bands * 0.85);
    color += mist * pow(glow, 4.2) * 0.32;
    color += vec3<f32>(0.06, 0.1, 0.08) * grid * 0.2;

    let vignette = smoothstep(1.75, 0.2, length(centered));
    color *= vignette;

    return vec4<f32>(color, 1.0);
}
