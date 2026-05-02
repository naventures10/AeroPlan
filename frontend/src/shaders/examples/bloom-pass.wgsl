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

const COLOR_RANGE: f32 = 24.0;
const TAU: f32 = 6.283185307;

fn jodie_reinhard_tonemap(c: vec3<f32>) -> vec3<f32> {
    let l = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
    let tc = c / (c + 1.0);
    return mix(c / (l + 1.0), tc, tc);
}

// ─── Simple SDF Shapes ───────────────────────────────────────────────────
fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

fn sdBox(p: vec2<f32>, b: vec2<f32>) -> f32 {
    let d = abs(p) - b;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}

fn sdEquilateralTriangle(p: vec2<f32>, r: f32) -> f32 {
    let k = sqrt(3.0);
    var p2 = p;
    p2.x = abs(p2.x) - r;
    p2.y = p2.y + r / k;
    if (p2.x + k * p2.y > 0.0) {
        p2 = vec2<f32>(p2.x - k * p2.y, -k * p2.x - p2.y) / 2.0;
    }
    p2.x -= clamp(p2.x, -2.0 * r, 0.0);
    return -length(p2) * sign(p2.y);
}

// ─── Procedural LDR scene ──────────────────────────────────────────────
fn scene_ldr(p: vec2<f32>, blur_radius: f32) -> vec3<f32> {
    let sm = max(0.005, blur_radius); // anti-aliasing smoothness or blur
    let intensity = 0.08; // Keeps the base color low so the aggressive tonemapping works

    // Orange Circle
    let d1 = sdCircle(p - vec2<f32>(-0.6, 0.0), 0.15);
    // For a glow, we want the interior to be solid, and the exterior to fade out smoothly.
    // If d < 0, it's inside. We fade from d=0 (edge) to d=sm (far outside).
    let circle = 1.0 - smoothstep(0.0, sm, d1);
    let color1 = vec3<f32>(1.0, 0.8, 0.3) * circle * intensity;

    // Green Triangle
    let d2 = sdEquilateralTriangle(p - vec2<f32>(0.0, -0.05), 0.15);
    let triangle = 1.0 - smoothstep(0.0, sm, d2);
    let color2 = vec3<f32>(0.3, 1.0, 0.3) * triangle * intensity;

    // Blue Square
    let d3 = sdBox(p - vec2<f32>(0.6, 0.0), vec2<f32>(0.13));
    let square = 1.0 - smoothstep(0.0, sm, d3);
    let color3 = vec3<f32>(0.3, 0.8, 1.0) * square * intensity;

    return clamp(color1 + color2 + color3, vec3<f32>(0.0), vec3<f32>(1.0));
}

// ─── Procedural multi-LOD bloom ────────────────────────────────────────
fn get_bloom(p: vec2<f32>) -> vec3<f32> {
    var blur = vec3<f32>(0.0);
    let weights = array<f32, 5>(1.0, 1.3, 1.6, 1.9, 2.2);

    for (var lod = 0u; lod < 5u; lod = lod + 1u) {
        // Analytically blur the SDFs instead of using expensive texture tap offsets!
        // This gives a perfectly smooth, infinite-resolution bloom with zero ghosting.
        let blur_radius = exp2(f32(lod + 2u)) * 0.015;
        let lod_color = scene_ldr(p, blur_radius);

        blur += pow(lod_color, vec3<f32>(2.2)) * weights[lod];
    }

    return blur * COLOR_RANGE;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = uniforms.resolution.x / max(uniforms.resolution.y, 1.0);
    // Aspect-correct coordinate space centered at 0,0
    let p = (in.uv - 0.5) * vec2<f32>(aspect, 1.0);

    // Scene color → linearise (replicating original double-pow)
    // Pass 0.0 for blur_radius so the base shapes are perfectly sharp
    var color = pow(scene_ldr(p, 0.0) * COLOR_RANGE, vec3<f32>(2.2));
    color = pow(color, vec3<f32>(2.2));

    // Add bloom
    color += pow(get_bloom(p), vec3<f32>(2.2));

    // Gamma encode
    color = pow(color, vec3<f32>(1.0 / 2.2));

    // Tonemap
    color = jodie_reinhard_tonemap(color);

    return vec4<f32>(color, 1.0);
}
