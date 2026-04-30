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

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32, instance: NodeInstance) -> VertexOutput {
    let corners = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
    );

    let aspect = ubo.resolution.x / max(ubo.resolution.y, 1.0);
    let center_world = aspectify(instance.position);
    
    var extent = instance.size * 1.5;
    if (u32(instance.node_type + 0.5) == 2u) {
        extent = instance.size * 2.5;
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
    let softness = 0.002;

    var alpha = 0.0;
    let type_id = u32(in.node_type + 0.5);

    switch (type_id) {
        case 0u: { alpha = smoothstep(0.0, -softness, sdHexagon(in.local, r)); }
        case 1u: { alpha = smoothstep(0.0, -softness, sdOctagon(in.local, r)); }
        case 2u: { alpha = smoothstep(0.0, -softness, sdNDB(in.local, r, time)); }
        case 3u: { alpha = smoothstep(0.0, -softness, sdBox(in.local, r)); }
        case 4u, 5u: { alpha = smoothstep(0.0, -softness, sdTriangle(in.local, r)); }
        case 6u: { alpha = smoothstep(0.0, -softness, sdDiamond(in.local, r)); }
        default: { alpha = smoothstep(r, r - softness, length(in.local)); }
    }
    
    if (alpha <= 0.0) { discard; }
    return vec4<f32>(color * alpha, alpha);
}
