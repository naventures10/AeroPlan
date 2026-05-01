struct Uniforms {
    resolution: vec2<f32>,
    cursor: vec2<f32>,
    metadata: vec4<f32>,
    metadata2: vec4<f32>,
    metadata3: vec4<f32>,
};

@group(0) @binding(0) var<uniform> ubo: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;
    let uv = vec2<f32>(
        f32((vertex_index << 1u) & 2u),
        f32(vertex_index & 2u)
    );
    let pos = uv * 2.0 - 1.0;
    out.position = vec4<f32>(pos, 0.0, 1.0);
    out.uv = pos; 
    return out;
}

fn rotate2d(p: vec2<f32>, angle: f32) -> vec2<f32> {
    let s = sin(angle);
    let c = cos(angle);
    return vec2<f32>(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Hexagon SDF
fn sd_hexagon(p: vec2<f32>, r: f32) -> f32 {
    let k = vec3<f32>(-0.866025404, 0.5, 0.577350269);
    var p_abs = abs(p);
    p_abs -= 2.0 * min(dot(k.xy, p_abs), 0.0) * k.xy;
    p_abs -= vec2<f32>(clamp(p_abs.x, -k.z * r, k.z * r), r);
    return length(p_abs) * sign(p_abs.y);
}

// Circle Outline SDF
fn sd_circle_outline(p: vec2<f32>, r: f32, thickness: f32) -> f32 {
    return abs(length(p) - r) - thickness;
}

// Line Segment SDF
fn sd_segment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = ubo.resolution.x / ubo.resolution.y;
    var p = vec2<f32>(in.uv.x * aspect, in.uv.y);

    let time = ubo.metadata.x;
    let rotation = ubo.metadata.w; 
    let circleRadius = ubo.metadata2.y;
    let lineLength = ubo.metadata2.z;
    let tickCount = ubo.metadata2.w;
    let tickLength = ubo.metadata3.x;
    
    // Animation Timing
    let loop_duration = 3.0;
    let t = time % loop_duration;
    
    // Phase 1: Circle grows clockwise from North (0.0 to 1.2s)
    let circle_progress = clamp(t / 1.2, 0.0, 1.0);
    
    // Phase 2: Lines grow inward (1.2 to 2.2s)
    let line_progress = clamp((t - 1.2) / 1.0, 0.0, 1.0);
    
    let p_rot = rotate2d(p, rotation);

    // 1. Hexagon (Always pulsing)
    let pulse = 1.0 + 0.03 * sin(time * 4.0);
    let d_hex = sd_hexagon(p_rot, 0.4 * pulse);
    
    // 2. Circle with clockwise completion mask
    let d_circle = sd_circle_outline(p, circleRadius, 0.01);
    
    // Calculate angle for mask: 0 at North, clockwise to 1.0
    let angle = atan2(p.x, p.y); // atan2(x, y) starts at North (y+)
    var angle_norm = (angle / 6.28318530718); // range [-0.5, 0.5]
    if (angle_norm < 0.0) { angle_norm += 1.0; } // range [0, 1]
    
    // Soft completion mask
    let angle_softness = 0.02;
    let circle_mask = 1.0 - smoothstep(circle_progress - angle_softness, circle_progress, angle_norm);

    // 3. Inward Lines (Animated by line_progress)
    let thickness = 0.01;
    let current_line_len = lineLength * line_progress;
    let current_tick_len = tickLength * line_progress;
    
    let inner_r = circleRadius - current_line_len;
    
    let d_n = sd_segment(p, vec2<f32>(0.0, circleRadius), vec2<f32>(0.0, inner_r)) - thickness;
    let d_s = sd_segment(p, vec2<f32>(0.0, -circleRadius), vec2<f32>(0.0, -inner_r)) - thickness;
    let d_e = sd_segment(p, vec2<f32>(circleRadius, 0.0), vec2<f32>(inner_r, 0.0)) - thickness;
    let d_w = sd_segment(p, vec2<f32>(-circleRadius, 0.0), vec2<f32>(-inner_r, 0.0)) - thickness;
    
    var d_lines = min(min(d_n, d_s), min(d_e, d_w));

    if (tickCount > 0.0) {
        let angle_step = 6.28318530718 / tickCount;
        let p_angle = atan2(p.y, p.x);
        let snapped_angle = round(p_angle / angle_step) * angle_step;
        let tick_dir = vec2<f32>(cos(snapped_angle), sin(snapped_angle));
        let p1 = tick_dir * circleRadius;
        let p2 = tick_dir * (circleRadius - current_tick_len);
        let d_tick = sd_segment(p, p1, p2) - (thickness * 0.7);
        d_lines = min(d_lines, d_tick);
    }
    
    // Combine and apply masks
    let edge_softness = fwidth(p.x); // Estimate pixel width for AA
    
    let hex_alpha = 1.0 - smoothstep(-edge_softness, edge_softness, d_hex);
    let circle_alpha = (1.0 - smoothstep(-edge_softness, edge_softness, d_circle)) * circle_mask;
    let lines_alpha = 1.0 - smoothstep(-edge_softness, edge_softness, d_lines);
    
    let final_alpha = max(hex_alpha, max(circle_alpha, lines_alpha));
    
    let color = vec3<f32>(0.2, 0.6, 1.0); 
    return vec4<f32>(color * final_alpha, final_alpha);
}
