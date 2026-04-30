struct Uniforms {
    resolution: vec2<f32>,
    cursor: vec2<f32>,
    metadata: vec4<f32>,
    metadata2: vec4<f32>,
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

// --- SDF Functions ---

fn sdf_circle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

fn sdf_dot_ring(p: vec2<f32>, r: f32, dot_r: f32, count: f32, rotation: f32) -> f32 {
    let angle_step = 6.28318530718 / max(count, 1.0);
    
    let angle = atan2(p.y, p.x) - rotation;
    let snapped_angle = round(angle / angle_step) * angle_step + rotation;
    
    let dot_pos = vec2<f32>(cos(snapped_angle), sin(snapped_angle)) * r;
    return length(p - dot_pos) - dot_r;
}

fn sdf_radio_nav(p: vec2<f32>) -> f32 {
    let time = ubo.metadata.x;
    let ringCount = i32(ubo.metadata.y);
    let ringSpacing = ubo.metadata.z;
    let rotationBase = ubo.metadata.w;
    let dotDensity = ubo.metadata2.x;

    let dot_r = 0.08;
    let thickness = 0.02;

    // Slower overall cycle for better visibility
    let pulse_cycle = time * 0.7;
    
    // Center pulse
    let f = fract(pulse_cycle);
    let center_pulse = max(0.0, sin(f * 3.14159 * 2.0)); // Shorter, sharper center pulse
    var d = sdf_circle(p, dot_r * (1.0 + 0.15 * center_pulse));
    
    for (var i: i32 = 1; i <= 4; i++) {
        if (i > ringCount) { break; }
        
        let r_base = f32(i) * ringSpacing;
        let dot_count = floor(12.0 * f32(i) * (1.0 + ringSpacing * 0.5) * dotDensity);
        let rot = rotationBase * f32(i) * 0.5;
        
        // Larger delay (0.2 instead of 0.1) for more sequential feel
        let phase_offset = f32(i) * 0.2;
        let ring_trigger = fract(pulse_cycle - phase_offset);
        
        // Sharpen the growth window: multiply by 2.0 and clamp 
        // to make the dots active for only half the cycle.
        let active_window = ring_trigger * 2.0;
        var growth_envelope = 0.0;
        if (active_window < 1.0) {
            growth_envelope = sin(active_window * 3.14159);
        }
        
        // Proportional size reduction for outer rings
        let size_reduction = 1.0 / f32(i);
        let ring_thickness = thickness * growth_envelope * size_reduction;
        let ring_r = r_base + ring_trigger * ringSpacing * 0.2;
        
        if (ring_thickness > 0.0001) {
            d = min(d, sdf_dot_ring(p, ring_r, ring_thickness, dot_count, rot));
        }
    }
    
    return d;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = ubo.resolution.x / ubo.resolution.y;
    let p = vec2<f32>(in.uv.x * aspect, in.uv.y);

    let color = vec4<f32>(1.0, 1.0, 1.0, 1.0);
    let d = sdf_radio_nav(p);
    
    let edge_softness = fwidth(d);
    let alpha = 1.0 - smoothstep(-edge_softness, edge_softness, d);
    
    return vec4<f32>(color.rgb * alpha, alpha);
}
