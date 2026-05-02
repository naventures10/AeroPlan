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

// --- Utilities ---

fn luminance(col: vec3<f32>) -> f32 {
    return 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
}

fn set_luminance(col: vec3<f32>, lum: f32) -> vec3<f32> {
    return col * (lum / max(luminance(col), 0.001));
}

fn scene_dist(p: vec2<f32>) -> f32 {
    let center = uniforms.resolution / 2.0;
    let b = vec2<f32>(150.0, 50.0);
    let q = abs(p - center) - b;
    return length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0) - 20.0;
}

fn scene_smooth(p: vec2<f32>, r: f32) -> f32 {
    var accum = scene_dist(p);
    accum += scene_dist(p + vec2<f32>(0.0, r));
    accum += scene_dist(p + vec2<f32>(0.0, -r));
    accum += scene_dist(p + vec2<f32>(r, 0.0));
    accum += scene_dist(p + vec2<f32>(-r, 0.0));
    return accum / 5.0;
}

fn get_ao(p: vec2<f32>, dist: f32, radius: f32, intensity: f32) -> f32 {
    let a = clamp(dist / radius, 0.0, 1.0) - 1.0;
    return 1.0 - (pow(abs(a), 5.0) + 1.0) * intensity + (1.0 - intensity);
}

// --- Original Shadow Logic ---

fn get_shadow(p: vec2<f32>, pos: vec2<f32>, radius: f32) -> f32 {
    let delta = pos - p;
    let dl = length(delta);
    if (dl < 0.001) { return 1.0; }
    
    let dir = delta / dl;
    var lf = radius * dl;
    var dt = 0.1;

    for (var i: i32 = 0; i < 64; i = i + 1) {
        let sd = scene_dist(p + dir * dt);
        if (sd < -radius) { return 0.0; }
        lf = min(lf, sd / dt);
        dt += max(1.0, abs(sd));
        if (dt > dl) { break; }
    }

    let res = clamp((lf * dl + radius) / (2.0 * radius), 0.0, 1.0);
    return smoothstep(0.0, 1.0, res);
}

fn draw_light(p: vec2<f32>, pos: vec2<f32>, color: vec3<f32>, range: f32, radius: f32) -> vec3<f32> {
    let ld = length(p - pos);
    if (ld > range) { return vec3<f32>(0.0); }
    
    let shad = get_shadow(p, pos, radius);
    var fall = (range - ld) / range;
    fall *= fall;
    
    let source = clamp(-(ld - radius), 0.0, 1.0);
    return color * (shad * fall + source);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let p = in.uv * uniforms.resolution;
    let time = uniforms.metadata.x;
    let res = uniforms.resolution;
    let center = res / 2.0;
    
    // Exact Light Implementation
    let l1_pos = uniforms.cursor * res;
    let l1_col = set_luminance(vec3<f32>(0.75, 1.0, 0.5), 0.4);
    
    let l2_pos = vec2<f32>(res.x * (sin(time + 3.1415) + 1.2) / 2.4, 175.0);
    let l2_col = set_luminance(vec3<f32>(1.0, 0.75, 0.5), 0.5);
    
    let l3_pos = vec2<f32>(res.x * (sin(time) + 1.2) / 2.4, 340.0);
    let l3_col = set_luminance(vec3<f32>(0.5, 0.75, 1.0), 0.6);
    
    // Background + Vignette
    var color = vec3<f32>(0.5) * (1.0 - length(center - p) / res.x);
    
    // Grid (mod 10.0)
    let grid = clamp(min(p.y % 10.0, p.x % 10.0), 0.9, 1.0);
    color *= grid;
    
    // Ambient Occlusion
    color *= get_ao(p, scene_smooth(p, 10.0), 40.0, 0.4);

    // Apply Lighting
    let dist = scene_dist(p);
    color += draw_light(p, l1_pos, l1_col, 150.0, 6.0);
    color += draw_light(p, l2_pos, l2_col, 200.0, 8.0);
    color += draw_light(p, l3_pos, l3_col, 300.0, 12.0);
    
    // Draw Shape (fillMask)
    let shape_mask = clamp(-dist, 0.0, 1.0);
    color = mix(color, vec3<f32>(0.18, 0.98, 0.85), shape_mask);
    
    // Shape Outline (innerBorderMask 1.5)
    let alpha1 = clamp(dist + 1.5, 0.0, 1.0);
    let alpha2 = clamp(dist, 0.0, 1.0);
    let border_mask = alpha1 - alpha2;
    color = mix(color, vec3<f32>(0.1), border_mask);
    
    return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
