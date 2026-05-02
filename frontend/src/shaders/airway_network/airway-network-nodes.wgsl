struct Uniforms {
    resolution: vec2<f32>,
    cursor: vec2<f32>,
    metadata: vec4<f32>,
    metadata2: vec4<f32>,
};

struct NodeInstance {
    @location(0) position: vec2<f32>,
    @location(1) size: f32,
    @location(2) node_type: f32,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) local: vec2<f32>,
    @location(1) size: f32,
    @location(2) node_type: f32,
};

@group(0) @binding(0) var<uniform> ubo: Uniforms;

// --- Helpers ---

fn aspectify(point: vec2<f32>) -> vec2<f32> {
    return point * 2.0 - 1.0;
}

fn world_to_clip(point: vec2<f32>, aspect: f32) -> vec4<f32> {
    return vec4<f32>(point.x / aspect, point.y, 0.0, 1.0);
}

fn node_color(node_type: f32) -> vec3<f32> {
    // #DCF0F5: Light Cyan/White for high contrast on blue background
    return vec3<f32>(0.8627, 0.9412, 0.9608);
}

fn rotate2d(p: vec2<f32>, angle: f32) -> vec2<f32> {
    let s = sin(angle);
    let c = cos(angle);
    return vec2<f32>(p.x * c - p.y * s, p.x * s + p.y * c);
}

// --- SDF Shapes ---

fn sdBox(p: vec2<f32>, b: f32) -> f32 {
    let d = abs(p) - vec2<f32>(b);
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}

fn sdHexagon(p: vec2<f32>, r: f32) -> f32 {
    let k = vec3<f32>(-0.866025404, 0.5, 0.577350269);
    var p_abs = abs(p);
    p_abs -= 2.0 * min(dot(k.xy, p_abs), 0.0) * k.xy;
    p_abs -= vec2<f32>(clamp(p_abs.x, -k.z * r, k.z * r), r);
    return length(p_abs) * sign(p_abs.y);
}

fn sdOctagon(p: vec2<f32>, r: f32) -> f32 {
    let k = vec3<f32>(-0.9238795325, 0.3826834323, 0.4142135623);
    var p_abs = abs(p);
    p_abs -= 2.0 * min(dot(k.xy, p_abs), 0.0) * k.xy;
    p_abs -= 2.0 * min(dot(vec2<f32>(-k.x, k.y), p_abs), 0.0) * vec2<f32>(-k.x, k.y);
    p_abs -= vec2<f32>(clamp(p_abs.x, -k.z * r, k.z * r), r);
    return length(p_abs) * sign(p_abs.y);
}

fn sdTriangle(p: vec2<f32>, r: f32) -> f32 {
    let k = sqrt(3.0);
    var p_mut = p;
    p_mut.x = abs(p_mut.x) - r;
    p_mut.y = p_mut.y + r / k;
    if (p_mut.x + k * p_mut.y > 0.0) {
        p_mut = vec2<f32>(p_mut.x - k * p_mut.y, -k * p_mut.x - p_mut.y) / 2.0;
    }
    p_mut.x -= clamp(p_mut.x, -2.0 * r, 0.0);
    return -length(p_mut) * sign(p_mut.y);
}

fn sdDiamond(p: vec2<f32>, r: f32) -> f32 {
    let p_abs = abs(p);
    return (p_abs.x + p_abs.y - r) * 0.70710678118;
}

fn sdCircleOutline(p: vec2<f32>, r: f32, thickness: f32) -> f32 {
    return abs(length(p) - r) - thickness;
}

fn sdSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

fn sdNDB(p: vec2<f32>, r: f32, time: f32) -> f32 {
    let total_scale = 1.25;
    let p_norm = p / (r * total_scale);
    let ringCount = 3;
    let ringSpacing = 0.15; // User parameter
    let rotationBase = 0.8726646; // 50 degrees in radians
    let dotDensity = 0.5;

    // Halved center dot size (from 1.0 to 0.5) as requested
    let dot_r = 0.5; 
    // Reduced base thickness to avoid huge first-ring dots
    let thickness = 0.28; 
    let pulse_cycle = time * 0.7;
    
    let f = fract(pulse_cycle);
    let center_pulse = max(0.0, sin(f * 3.1415926535 * 2.0));
    var d = length(p_norm) - (dot_r * (1.0 + 0.15 * center_pulse));
    
    for (var i: i32 = 1; i <= 3; i = i + 1) {
        // Further reduced gap for a tighter cluster
        let r_base = dot_r + 0.15 + f32(i) * ringSpacing; 
        let dot_count = floor(12.0 * f32(i) * (1.0 + ringSpacing * 0.5) * dotDensity);
        let rot = rotationBase * f32(i) * 0.5;
        
        let phase_offset = f32(i) * 0.2;
        let ring_trigger = fract(pulse_cycle - phase_offset);
        
        // Match source "sequential ping" behavior: dots are only visible during active window
        let active_window = ring_trigger * 2.0;
        var growth_envelope = 0.0;
        if (active_window < 1.0) {
            growth_envelope = sin(active_window * 3.1415926535);
        }
        
        // Proportional size reduction for outer rings as per source integrity
        let size_reduction = 1.0 / f32(i);
        let ring_thickness = thickness * growth_envelope * size_reduction;
        let ring_r = r_base + ring_trigger * ringSpacing * 0.2;
        
        if (ring_thickness > 0.0001) {
            let angle_step = 6.28318530718 / max(dot_count, 1.0);
            let angle = atan2(p_norm.y, p_norm.x) - rot;
            let snapped_angle = (round(angle / angle_step) * angle_step) + rot;
            let dot_pos = vec2<f32>(cos(snapped_angle), sin(snapped_angle)) * ring_r;
            let dot_dist = length(p_norm - dot_pos) - ring_thickness;
            d = min(d, dot_dist);
        }
    }
    return d * (r * 1.25);
}

fn sdDVOR(p: vec2<f32>, r: f32, time: f32) -> f32 {
    let circleRadius = 1.4 * r;
    let lineLength = 0.4 * r;
    let tickCount = 30.0;
    let tickLength = 0.15 * r;
    
    // Animation Timing
    let loop_duration = 4.0;
    let t = time % loop_duration;
    
    // Phase 1: Circle grows (0.0 to 1.5s)
    let circle_progress = clamp(t / 1.5, 0.0, 1.0);
    // Phase 2: Lines grow (1.5 to 2.5s)
    let line_progress = clamp((t - 1.5) / 1.0, 0.0, 1.0);
    
    // 1. Hexagon (Core)
    let d_hex = sdHexagon(p, 0.5 * r);
    
    // 2. Circle Outline
    let thickness = 0.12 * r; 
    let d_circle_raw = sdCircleOutline(p, circleRadius, thickness);
    
    // Clockwise Mask for circle
    let angle = atan2(p.x, p.y); 
    var angle_norm = (angle / 6.28318530718);
    if (angle_norm < 0.0) { angle_norm += 1.0; } 
    let circle_mask = smoothstep(circle_progress + 0.01, circle_progress - 0.01, angle_norm);
    
    // Apply mask
    let d_circle = max(d_circle_raw, -circle_mask + 0.5);

    // 3. Inward Lines
    let current_line_len = lineLength * line_progress;
    let current_tick_len = tickLength * line_progress;
    let inner_r = circleRadius - current_line_len;
    
    let d_n = sdSegment(p, vec2<f32>(0.0, circleRadius), vec2<f32>(0.0, inner_r)) - thickness;
    let d_s = sdSegment(p, vec2<f32>(0.0, -circleRadius), vec2<f32>(0.0, -inner_r)) - thickness;
    let d_e = sdSegment(p, vec2<f32>(circleRadius, 0.0), vec2<f32>(inner_r, 0.0)) - thickness;
    let d_w = sdSegment(p, vec2<f32>(-circleRadius, 0.0), vec2<f32>(-inner_r, 0.0)) - thickness;
    
    var d_lines = min(min(d_n, d_s), min(d_e, d_w));

    if (tickCount > 0.0 && line_progress > 0.01) {
        let angle_step = 6.28318530718 / tickCount;
        let p_angle = atan2(p.y, p.x);
        let snapped_angle = round(p_angle / angle_step) * angle_step;
        let tick_dir = vec2<f32>(cos(snapped_angle), sin(snapped_angle));
        let p1 = tick_dir * circleRadius;
        let p2 = tick_dir * (circleRadius - current_tick_len);
        let d_tick = sdSegment(p, p1, p2) - (thickness * 0.7);
        d_lines = min(d_lines, d_tick);
    }
    
    // Combine everything
    var res = d_hex;
    res = min(res, d_circle);
    if (line_progress > 0.0) {
        res = min(res, d_lines);
    }
    
    return res;
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32, instance: NodeInstance) -> VertexOutput {
    let corners = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
    );

    let aspect = ubo.resolution.x / max(ubo.resolution.y, 1.0);
    let center_world = aspectify(instance.position);
    
    var extent = instance.size * 1.5;
    let type_id = u32(instance.node_type + 0.5);
    if (type_id == 2u || type_id == 4u || type_id == 5u) {
        extent = instance.size * 3.0; // Reduced extent for smaller symbol
    }
    
    let local = corners[vertex_index] * extent;

    var out: VertexOutput;
    out.position = world_to_clip(center_world + local, aspect);
    out.local = local;
    out.size = instance.size;
    out.node_type = instance.node_type;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let time = ubo.metadata.x;
    let color = node_color(in.node_type);
    
    let pulse = 0.08 * sin(time * 2.5);
    let r = in.size * (1.0 + pulse);
    
    var alpha = 0.0;
    let type_id = u32(in.node_type + 0.5);

    switch (type_id) {
        case 0u: { alpha = smoothstep(0.0, -0.002, sdHexagon(in.local, r)); }
        case 1u: { alpha = smoothstep(0.0, -0.002, sdOctagon(in.local, r)); }
        case 2u: { alpha = smoothstep(0.0, -0.002, sdNDB(in.local, r, time)); }
        case 3u: { alpha = smoothstep(0.0, -0.002, sdBox(in.local, r)); }
        case 4u, 5u: { 
            // Sharper softness for DVOR to avoid fading out thick strokes
            alpha = smoothstep(0.0, -0.001, sdDVOR(in.local, r, time)); 
        }
        case 6u: { alpha = smoothstep(0.0, -0.002, sdDiamond(in.local, r)); }
        default: { alpha = smoothstep(r, r - 0.002, length(in.local)); }
    }
    
    if (alpha <= 0.0) { discard; }
    return vec4<f32>(color * alpha, alpha);
}
