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

fn radar_ping(uv: vec2<f32>, center: vec2<f32>, inner_tail: f32, frontier: f32, reset_sec: f32, speed: f32, fade_dist: f32, time: f32) -> f32 {
    let diff = center - uv;
    let r = length(diff);
    let pt = (time % reset_sec) * speed;
    
    var circle = smoothstep(pt - inner_tail, pt, r) * smoothstep(pt + frontier, pt, r);
    circle *= smoothstep(fade_dist, 0.0, r);
    return circle;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    let uv = (in.uv * 2.0 - 1.0) * vec2<f32>(aspect, 1.0);
    let cursor = (uniforms.cursor * 2.0 - 1.0) * vec2<f32>(aspect, 1.0);
    let time = uniforms.metadata.x;

    let green = vec3<f32>(0.0, 1.0, 0.4);
    
    // Multiple pings
    let p1 = radar_ping(uv, vec2<f32>(0.0), 0.25, 0.025, 4.0, 0.3, 1.0, time);
    let p2 = radar_ping(uv, cursor, 0.1, 0.01, 3.0, 0.4, 0.6, time + 1.0);
    
    let final_color = green * (p1 + p2);
    return vec4<f32>(final_color, 1.0);
}
