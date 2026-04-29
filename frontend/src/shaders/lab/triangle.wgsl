struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) barycentric: vec3<f32>,
    @location(1) @interpolate(flat) render_type: u32,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;
    
    // Triangle Positions (centered vertically, spread horizontally)
    let positions = array<vec2<f32>, 9>(
        // Left Triangle (No AA)
        vec2<f32>(-0.6,  0.4), vec2<f32>(-0.8, -0.4), vec2<f32>(-0.4, -0.4),
        // Center Triangle (Shader AA)
        vec2<f32>( 0.0,  0.4), vec2<f32>(-0.2, -0.4), vec2<f32>( 0.2, -0.4),
        // Right Triangle (Hardware MSAA)
        vec2<f32>( 0.6,  0.4), vec2<f32>( 0.4, -0.4), vec2<f32>( 0.8, -0.4)
    );

    // Barycentric coordinates for edge smoothing
    let barycentrics = array<vec3<f32>, 3>(
        vec3<f32>(1.0, 0.0, 0.0),
        vec3<f32>(0.0, 1.0, 0.0),
        vec3<f32>(0.0, 0.0, 1.0)
    );

    out.position = vec4<f32>(positions[vertex_index], 0.0, 1.0);
    out.render_type = vertex_index / 3u;
    out.barycentric = barycentrics[vertex_index % 3u];

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let orange = vec4<f32>(1.0, 0.5, 0.0, 1.0);

    // Calculate distance to the nearest edge
    let d = min(min(in.barycentric.x, in.barycentric.y), in.barycentric.z);
    
    // fwidth must be called outside of non-uniform control flow (if blocks)
    let edge_softness = fwidth(d);

    // Center Triangle (Shader AA) logic
    if (in.render_type == 1u) {
        let alpha = smoothstep(0.0, edge_softness, d);
        // Using premultiplied alpha for correct blending
        return vec4<f32>(orange.rgb * alpha, alpha);
    }

    return orange;
}
