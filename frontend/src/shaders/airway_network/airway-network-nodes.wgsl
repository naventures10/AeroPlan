struct ShaderUniforms {
    resolution: vec2<f32>,
    cursor: vec2<f32>,
    metadata: vec4<f32>,
};

struct NodeInstance {
    @location(0) position: vec2<f32>,
    @location(1) size: f32,
    @location(2) node_type: f32,
    @location(3) node_index: f32,
    @location(4) frequency_norm: f32,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) local: vec2<f32>,
    @location(1) size: f32,
    @location(2) node_type: f32,
    @location(3) node_index: f32,
    @location(4) center_world: vec2<f32>,
    @location(5) frequency_norm: f32,
};

@group(0) @binding(0) var<uniform> uniforms: ShaderUniforms;

const NODE_COUNT: u32 = 14u;
const TWO_PI: f32 = 6.28318530718;
const PI: f32 = 3.14159265359;

fn aspectify(point: vec2<f32>, aspect: f32) -> vec2<f32> {
    return (point - 0.5) * vec2<f32>(aspect, 1.0);
}

fn world_to_clip(point: vec2<f32>, aspect: f32) -> vec4<f32> {
    return vec4<f32>(point.x / aspect * 2.0, point.y * 2.0, 0.0, 1.0);
}

fn node_position(index: u32) -> vec2<f32> {
    let points = array<vec2<f32>, 14>(
        vec2<f32>(0.12, 0.68),
        vec2<f32>(0.23, 0.61),
        vec2<f32>(0.36, 0.57),
        vec2<f32>(0.48, 0.63),
        vec2<f32>(0.63, 0.59),
        vec2<f32>(0.79, 0.66),
        vec2<f32>(0.21, 0.38),
        vec2<f32>(0.35, 0.42),
        vec2<f32>(0.53, 0.44),
        vec2<f32>(0.67, 0.40),
        vec2<f32>(0.82, 0.32),
        vec2<f32>(0.43, 0.25),
        vec2<f32>(0.61, 0.21),
        vec2<f32>(0.77, 0.18)
    );
    return points[index];
}

fn node_color(node_type: f32) -> vec3<f32> {
    if (node_type < 0.5) {
        return vec3<f32>(0.42, 0.82, 1.0);
    }
    if (node_type < 1.5) {
        return vec3<f32>(0.98, 0.76, 0.36);
    }
    if (node_type < 2.5) {
        return vec3<f32>(0.95, 0.52, 0.62);
    }
    return vec3<f32>(0.61, 0.96, 0.74);
}

fn band(distance: f32, radius: f32, width: f32) -> f32 {
    return smoothstep(width, 0.0, abs(distance - radius));
}

// Shadertoy-style RadarPing ring.
// 'r'          : distance from node center (local space)
// 't'          : current time (with optional phase offset for staggering)
// 'reset_sec'  : how long one full cycle takes (longer = slower, sparser)
// 'speed'      : units per second the ring expands
// 'inner_tail' : soft trailing-edge width (creates the phosphor smear)
// 'frontier'   : hard leading-edge width (sharper front = more ping-like)
// 'fade_dist'  : ring fades to 0 at this radius, preventing any box clip
fn radar_ping_ring(
    r: f32, t: f32,
    reset_sec: f32, speed: f32,
    inner_tail: f32, frontier: f32,
    fade_dist: f32
) -> f32 {
    // Current ring radius: linearly expands from 0 to (reset_sec * speed) over each cycle
    let pt = (t % reset_sec) * speed;
    // Thin ring band: trailing soft edge, sharp leading edge
    var c = smoothstep(pt - inner_tail, pt, r) * smoothstep(pt + frontier, pt, r);
    // Spatial envelope: ring fades to 0 at fade_dist regardless of pt
    c *= smoothstep(fade_dist, fade_dist * 0.05, r);
    return c;
}

fn signature(distance: f32, local: vec2<f32>, node_type: f32, size: f32, time: f32) -> f32 {
    if (node_type < 0.5) {
        return band(distance, size * 2.0, 0.012) + band(distance, size * 3.15, 0.012) * 0.55;
    }
    if (node_type < 1.5) {
        let cross = smoothstep(0.006, 0.0, abs(local.x)) + smoothstep(0.006, 0.0, abs(local.y));
        return band(distance, size * 2.75, 0.012) * 0.82 + cross * smoothstep(size * 3.0, 0.0, distance) * 0.24;
    }
    if (node_type < 2.5) {
        let flicker = 0.72 + 0.28 * sin(time * 4.0 + distance * 40.0);
        return smoothstep(size * 4.1, size * 0.75, distance) * flicker * 0.6;
    }

    let diamond = abs(local.x) + abs(local.y);
    return smoothstep(size * 2.4, size * 0.45, diamond);
}

@vertex
fn vs_main(
    @builtin(vertex_index) vertex_index: u32,
    instance: NodeInstance,
) -> VertexOutput {
    let corners = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0)
    );

    let aspect = uniforms.resolution.x / max(uniforms.resolution.y, 1.0);
    let center_world = aspectify(instance.position, aspect);
    // Extend quad enough to contain the full ping fade (max ping radius ~0.30)
    let ping_max_r = 0.30;
    let extent = instance.size * 5.2 + ping_max_r + 0.04;
    let local = corners[vertex_index] * extent;

    var out: VertexOutput;
    out.position = world_to_clip(center_world + local, aspect);
    out.local = local;
    out.size = instance.size;
    out.node_type = instance.node_type;
    out.node_index = instance.node_index;
    out.center_world = center_world;
    out.frequency_norm = instance.frequency_norm;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = uniforms.resolution.x / max(uniforms.resolution.y, 1.0);
    let time = uniforms.metadata.x;
    let hovered_index = i32(uniforms.metadata.y);
    let hover_mix = uniforms.metadata.z;
    let pulse_radius = max(time - uniforms.metadata.w, 0.0) * 0.23;

    var hovered_world = aspectify(uniforms.cursor, aspect);
    if (hovered_index >= 0 && hovered_index < i32(NODE_COUNT)) {
        hovered_world = aspectify(node_position(u32(hovered_index)), aspect);
    }

    let distance = length(in.local);
    let base = node_color(in.node_type);
    let hover = select(0.0, 1.0, hovered_index == i32(in.node_index)) * hover_mix;
    let relay_distance = length(in.center_world - hovered_world);
    let relay = band(relay_distance, pulse_radius, 0.052) * hover_mix;
    let pulse_ring = band(distance, pulse_radius, 0.018) * hover_mix;
    let breathe = 0.76 + 0.24 * sin(time * 1.1 + in.node_index * 1.43);
    let core = smoothstep(in.size * 1.5, in.size * 0.25, distance);
    let halo = smoothstep(in.size * 4.5, in.size * 0.72, distance);
    let ident = signature(distance, in.local, in.node_type, in.size, time);

    // Radar Sweep effect
    let sweep_speed = 0.15;
    let angle = atan2(in.center_world.y, in.center_world.x);
    let normalized_angle = fract((angle + PI) / TWO_PI);
    let normalized_sweep = fract(time * sweep_speed);
    
    var angle_diff = normalized_sweep - normalized_angle;
    if (angle_diff < 0.0) {
        angle_diff += 1.0;
    }
    let phosphor = pow(1.0 - angle_diff, 6.0) * 0.8; 
    let head_flash = smoothstep(0.01, 0.0, angle_diff) * 1.5;
    let sweep_boost = phosphor + head_flash;

    // ---- Radar Ping (Shadertoy-style) --------------------------------
    // Slow, procedural rings. `frequency_norm` only shifts the reset cycle
    // length slightly so nearby nodes stay in sync-ish rather than fighting.
    let ping_reset   = 4.0 + in.frequency_norm * 2.0; // 4-6 s cycle
    let ping_speed   = 0.055;   // units/second expansion (slow, deliberate)
    let ping_tail    = 0.08;    // phosphor trailing-edge softness
    let ping_edge    = 0.003;   // sharp leading edge
    let ping_fade    = 0.28;    // fade to 0 at this radius (inside the quad)

    // Stagger 3 rings evenly across the reset window so one is always mid-travel
    let phase_step   = ping_reset / 3.0;
    let r1 = radar_ping_ring(distance, time,                  ping_reset, ping_speed, ping_tail, ping_edge, ping_fade);
    let r2 = radar_ping_ring(distance, time + phase_step,     ping_reset, ping_speed, ping_tail, ping_edge, ping_fade);
    let r3 = radar_ping_ring(distance, time + phase_step * 2.0, ping_reset, ping_speed, ping_tail, ping_edge, ping_fade);
    // VORs (type 0) show all 3 rings; others show 2, waypoints show 1
    var total_ping = r1;
    if (in.node_type < 1.5) { total_ping += r2; }
    if (in.node_type < 0.5) { total_ping += r3; }
    // -------------------------------------------------------------------

    var color = base * core * (0.62 + hover * 0.95);
    color += base * halo * (0.12 + breathe * 0.12 + relay * 0.24);
    color += base * ident * (0.34 + hover * 0.44);
    color += vec3<f32>(0.88, 0.98, 1.0) * pulse_ring * (core + ident) * 0.42;
    color += base * total_ping * 1.6;

    // Boost intensity when sweep passes
    color += base * sweep_boost;

    let alpha = core * 0.48 + halo * 0.18 + ident * 0.24 + pulse_ring * 0.12 + total_ping * 0.55 + head_flash * core;
    return vec4<f32>(color * alpha, alpha);
}
