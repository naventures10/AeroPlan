struct ShaderUniforms {
    resolution: vec2<f32>,
    cursor: vec2<f32>,
    metadata: vec4<f32>,
};

struct OutlineInstance {
    @location(0) start: vec2<f32>,
    @location(1) end: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) local: vec2<f32>,
    @location(1) a_world: vec2<f32>,
    @location(2) b_world: vec2<f32>,
    @location(3) world_pos: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: ShaderUniforms;

const TWO_PI: f32 = 6.28318530718;
const PI: f32 = 3.14159265359;

fn aspectify(point: vec2<f32>, aspect: f32) -> vec2<f32> {
    return (point - 0.5) * vec2<f32>(aspect, 1.0);
}

fn world_to_clip(point: vec2<f32>, aspect: f32) -> vec4<f32> {
    return vec4<f32>(point.x / aspect * 2.0, point.y * 2.0, 0.0, 1.0);
}

@vertex
fn vs_main(
    @builtin(vertex_index) vertex_index: u32,
    instance: OutlineInstance,
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
    let aspect = uniforms.resolution.x / max(uniforms.resolution.y, 1.0);
    let a_world = aspectify(instance.start, aspect);
    let b_world = aspectify(instance.end, aspect);
    let delta = b_world - a_world;
    let length_delta = max(length(delta), 0.0001);
    let tangent = delta / length_delta;
    let normal = vec2<f32>(-tangent.y, tangent.x);
    let extent = 0.003; // Fixed width for outlines
    let world = mix(a_world, b_world, local.x) + normal * local.y * extent;

    var out: VertexOutput;
    out.position = world_to_clip(world, aspect);
    out.local = vec2<f32>(local.x, local.y);
    out.a_world = a_world;
    out.b_world = b_world;
    out.world_pos = world;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let time = uniforms.metadata.x;
    
    // Core line profile
    let line_core = smoothstep(1.0, 0.2, abs(in.local.y));
    
    // Radar Sweep effect
    let sweep_speed = 0.15;
    let current_sweep_angle = fract(time * sweep_speed) * TWO_PI;
    
    // Calculate polar angle of the current fragment relative to screen center (0,0)
    let angle = atan2(in.world_pos.y, in.world_pos.x);
    let normalized_angle = fract((angle + PI) / TWO_PI); // 0.0 to 1.0
    let normalized_sweep = fract(time * sweep_speed);
    
    // Determine distance from the sweep head (creating a trailing effect)
    var angle_diff = normalized_sweep - normalized_angle;
    if (angle_diff < 0.0) {
        angle_diff += 1.0;
    }
    
    // Phosphor glow intensity based on how recently the sweep passed
    let phosphor = pow(1.0 - angle_diff, 8.0) * 1.5; 
    let head_flash = smoothstep(0.02, 0.0, angle_diff) * 2.0;

    let base_alpha = 0.1;
    let alpha = line_core * (base_alpha + phosphor + head_flash);
    
    let color = vec3<f32>(0.2, 0.4, 0.9); // Airspace blue
    
    return vec4<f32>(color * alpha, alpha);
}
