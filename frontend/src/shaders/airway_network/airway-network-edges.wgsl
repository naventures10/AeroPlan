struct Uniforms {
    resolution: vec2<f32>,
    cursor: vec2<f32>,
    metadata: vec4<f32>,
    metadata2: vec4<f32>,
};

struct EdgeInstance {
    @location(0) start: vec2<f32>,
    @location(1) end: vec2<f32>,
    @location(2) width: f32,
    @location(3) route_class: f32,
    @location(4) node_indices: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) local: vec2<f32>,
    @location(1) a_world: vec2<f32>,
    @location(2) b_world: vec2<f32>,
    @location(3) route_class: f32,
    @location(4) node_indices: vec2<f32>,
    @location(5) world_pos: vec2<f32>,
};

@group(0) @binding(0) var<uniform> ubo: Uniforms;

const NODE_COUNT: u32 = 14u;
const TWO_PI: f32 = 6.28318530718;
const PI: f32 = 3.14159265359;

fn aspectify(point: vec2<f32>) -> vec2<f32> {
    return point * 2.0 - 1.0;
}

fn world_to_clip(point: vec2<f32>, aspect: f32) -> vec4<f32> {
    return vec4<f32>(point.x / aspect, point.y, 0.0, 1.0);
}

fn hash11(p: f32) -> f32 {
    return fract(sin(p * 127.31) * 43758.5453123);
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
    return points[min(index, 13u)];
}

fn segment_distance(point: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = point - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
    return length(pa - ba * h);
}

fn band(distance: f32, radius: f32, width: f32) -> f32 {
    return smoothstep(width, 0.0, abs(distance - radius));
}

@vertex
fn vs_main(
    @builtin(vertex_index) vertex_index: u32,
    instance: EdgeInstance,
) -> VertexOutput {
    let corners = array<vec2<f32>, 6>(
        vec2<f32>(0.0, -1.0),
        vec2<f32>(1.0, -1.0),
        vec2<f32>(0.0,  1.0),
        vec2<f32>(0.0,  1.0),
        vec2<f32>(1.0, -1.0),
        vec2<f32>(1.0,  1.0)
    );

    let local = corners[vertex_index];
    let aspect = ubo.resolution.x / max(ubo.resolution.y, 1.0);
    let a_world = aspectify(instance.start);
    let b_world = aspectify(instance.end);
    let delta = b_world - a_world;
    let length_delta = max(length(delta), 0.0001);
    let tangent = delta / length_delta;
    let normal = vec2<f32>(-tangent.y, tangent.x);
    let extent = instance.width * 4.0;
    let world = mix(a_world, b_world, local.x) + normal * local.y * extent;

    var out: VertexOutput;
    out.position = world_to_clip(world, aspect);
    out.local = vec2<f32>(local.x, local.y * 4.0);
    out.a_world = a_world;
    out.b_world = b_world;
    out.route_class = instance.route_class;
    out.node_indices = instance.node_indices;
    out.world_pos = world;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = ubo.resolution.x / max(ubo.resolution.y, 1.0);
    let time = ubo.metadata.x;
    let hovered_index = i32(ubo.metadata.y);
    let hover_mix = ubo.metadata.z;
    let pulse_radius = max(time - ubo.metadata.w, 0.0) * 0.23;

    var hovered_world = aspectify(ubo.cursor);
    if (hovered_index >= 0 && hovered_index < i32(NODE_COUNT)) {
        hovered_world = aspectify(node_position(u32(hovered_index)));
    }

    let line_core = smoothstep(0.42, 0.0, abs(in.local.y));
    let line_glow = smoothstep(2.2, 0.0, abs(in.local.y));
    let major = in.route_class;
    let packet_phase = fract(time * (0.08 + major * 0.18) + hash11(in.node_indices.x * 2.7 + in.node_indices.y));
    
    // Precise Navigator Arrow SDF (GPS/Navigation style)
    let p_x = in.local.x - packet_phase;
    let q_y = abs(in.local.y) * 0.018; 
    
    // Geometric constants for an elongated, aerodynamic arrow
    let tip = 0.035;        // Extended front tip for sharpness
    let base_x = -0.015;    // Pulled back base
    let indent_x = -0.005;  // Deep indent for the navigator look
    let width = 0.011;      // Reduced width to remove squashed look
    
    // Half-plane check for the slanted side (tip to base corner)
    let side_dist = q_y - (width * (tip - p_x) / (tip - base_x));
    // Half-plane check for the back indent (indent to base corner)
    let back_dist = (indent_x + (base_x - indent_x) * q_y / width) - p_x;
    
    // The arrow is the intersection of these planes and the front tip limit
    let packet = smoothstep(0.0008, 0.0, max(max(side_dist, back_dist), p_x - tip));
    let relay_distance = segment_distance(hovered_world, in.a_world, in.b_world);
    let relay = band(relay_distance, pulse_radius, 0.04) * hover_mix;
    let direct = select(
        0.0,
        1.0,
        (hovered_index >= 0) &&
        ((u32(hovered_index) == u32(in.node_indices.x)) || (u32(hovered_index) == u32(in.node_indices.y)))
    ) * hover_mix;

    // Radar Sweep effect
    let sweep_speed = 0.15;
    let angle = atan2(in.world_pos.y, in.world_pos.x);
    let normalized_angle = fract((angle + PI) / TWO_PI);
    let normalized_sweep = fract(time * sweep_speed);
    
    var angle_diff = normalized_sweep - normalized_angle;
    if (angle_diff < 0.0) {
        angle_diff += 1.0;
    }
    let phosphor = pow(1.0 - angle_diff, 8.0) * 1.5; 
    let head_flash = smoothstep(0.01, 0.0, angle_diff) * 2.5;
    let sweep_boost = phosphor + head_flash;

    var color = mix(vec3<f32>(0.02, 0.12, 0.15), vec3<f32>(0.05, 0.28, 0.33), major);
    color += vec3<f32>(0.14, 0.92, 0.98) * (relay * 0.85 + direct * 0.55);
    color += vec3<f32>(1.0, 0.95, 0.8) * packet; // Solid bright arrow core
    color += vec3<f32>(0.98, 0.8, 0.38) * packet * sweep_boost * 0.5; // Added glow when sweep passes
    color += vec3<f32>(0.2, 0.5, 0.8) * sweep_boost * line_core; // Edges glow blue with sweep

    let alpha = line_core * 0.55 + line_glow * 0.18 + relay * line_glow * 0.55 + packet * 0.9 + sweep_boost * line_core * 0.5;
    return vec4<f32>(color * alpha, alpha);
}
