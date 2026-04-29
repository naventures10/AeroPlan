void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = fragCoord / iResolution.xy * 2. - 1.;
    uv.x *= iResolution.x / iResolution.y;
    
    float dist = length(uv);
    float pulse = 0.75 + 0.75 * sin(iTime * 3.0);
    
    float intensity = exp(-dist * 4.0) + 0.2 * pulse;
    
    vec3 color = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 1.0, 0.0), intensity);
    
    fragColor = vec4(color * intensity, 1.);
}

vec3 hsb2rgb(in vec3 c)
{
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),
                             6.0)-3.0)-1.0,
                     0.0,
                     1.0 );
    rgb = rgb*rgb*(3.0-2.0*rgb);
    return c.z * mix( vec3(1.0), rgb, c.y);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{   
    vec2 p = (2.0*fragCoord.xy-iResolution.xy)/iResolution.y;
    
    float r = length(p) * 0.9;
	vec3 color = hsb2rgb(vec3(0.24, 0.7, 0.4));
    
    float a = pow(r, 2.0);
    float b = sin(r * 0.8 - 1.6);
    float c = sin(r - 0.010);
    float s = sin(a - iTime * 3.0 + b) * c;
    
    color *= abs(1.0 / (s * 10.8)) - 0.01;
	fragColor = vec4(color, 1.);
}

//Author: asmith13
//Free to use as you wish. Have fun

#define green vec3(0.0,1.0,0.0)

// returns a vec3 color from every pixel requested.
// Generates a BnW Ping on normalized 2d coordinate system
vec3 RadarPing(in vec2 uv, in vec2 center, in float innerTail, 
               in float frontierBorder, in float timeResetSeconds, 
               in float radarPingSpeed, in float fadeDistance)
{
    vec2 diff = center-uv;
    float r = length(diff);
    float time = mod(iTime, timeResetSeconds) * radarPingSpeed;
   
    float circle;
    // r is the distance to the center.
    // circle = BipCenter---//---innerTail---time---frontierBorder
    //illustration
    //https://sketch.io/render/sk-14b54f90080084bad1602f81cadd4d07.jpeg
    circle += smoothstep(time - innerTail, time, r) * smoothstep(time + frontierBorder,time, r);
	circle *= smoothstep(fadeDistance, 0.0, r); // fade to 0 after fadeDistance
        
    return vec3(circle);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    //normalize coordinates 
    vec2 uv = fragCoord.xy / iResolution.xy; //move coordinates to 0..1
    uv = uv.xy*2.; // translate to the center
    uv += vec2(-1.0, -1.0);
    uv.x *= iResolution.x/iResolution.y; //correct the aspect ratio
    
	vec3 color;
    // generate some radar pings
    float fadeDistance = 1.0;
    float resetTimeSec = 4.0;
    float radarPingSpeed = 0.3;
    vec2 greenPing = vec2(0.0, 0.0);
    color += RadarPing(uv, greenPing, 0.25, 0.025, resetTimeSec, radarPingSpeed, fadeDistance) * green;
    
    //return the new color
	fragColor = vec4(color,1.0);
}

#define SF 1./min(iResolution.x,iResolution.y)

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    vec2 ouv = fragCoord/iResolution.xy;
    vec2 uv = (fragCoord - .5*iResolution.xy)/iResolution.y;    
        
    vec3 activeCol= texture(iChannel0, ouv).rgb;
    
    float l = length(uv);
    
    float m = 0.;
    
    float i = .1*round(l/.1);
    m += smoothstep(SF*2., 0., abs(i-l));            

    m += smoothstep(SF, 0., abs(SF-uv.x));   
    m += smoothstep(SF, 0., abs(SF-uv.y));    
    
    vec3 col = activeCol + vec3(0, 0.25, 0.) * m;
    col *= step(l, .51);
    
    fragColor = vec4(col, 1.);
}

// Author: asmith13
// mainly from https://www.shadertoy.com/view/MsG3WW - mlkn
// Free to use

// i finally understood polar coordinates..
// http://mathworld.wolfram.com/PolarCoordinates.html

#define green vec3(0.0,1.0,0.0)
#define red vec3(1.0,0.0,0.0)
const float PI = 3.1415926535897932384626433832795;
const float TWOPI = 6.283185307179586476925286766559;

float RadarSweep(in float time, in vec2 c, in vec2 center, in float radius, in float speed, in bool dir_cw, in float tailLength){
    
    time *= speed; // adjust speed by multiplying the time
    
    c -= center; //adjust pixel by asuming we are in the center at 0,0 !polar coordinate system!    
    if(!dir_cw) c.xy = c.yx; // simple hack i still don't understand it myself
    
    // x,y - polar coords see header
    float x = length(c); // x = length of 0,0 to current pixel
    // y is the angle of our coord system. i mod it to TWO PI to reduce doubler effects
    float y = mod(atan(c.y, c.x) + time, TWOPI);// see header or build in function

    y /= tailLength;// 1.0 - angle ... so we divide instead of multiplying
    
    float result = 0.0;
    if(x < radius) result += 1.0 - y;// if pixel is in radius x
       
    return result;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 Resolution = iResolution.xy; //resolution
    vec2 coords = (2.0 * fragCoord - Resolution) / Resolution.y; // aspectfixed coordinates [-1,1]2d
    
    //settings
    vec2 left = vec2(-1.0, 0.0);
    vec2 right = vec2(1.0, 0.0);
    float radius = PI / 4.0;
    float speed = 1.5;
    float tailLength = PI / 2.0;
    bool dir_cw = true;
    float time = iTime;
       
    fragColor += vec4(green * RadarSweep(time, coords, left,  radius, speed,  dir_cw, tailLength), 1.0);
    fragColor += vec4(red *   RadarSweep(time, coords, right, radius, speed, !dir_cw, tailLength), 1.0);
}

//Author: asmith13
//Free to use as you wish. Have fun

// Radar Bip
//https://www.shadertoy.com/view/4s2SRt by ndel
//https://www.shadertoy.com/view/Xsy3zG by Andre
// mainly from https://www.shadertoy.com/view/MtdGW7 runekill

#define green vec3(0.0,1.0,0.0)
#define red vec3(1.0,0.0,0.0)
#define blue vec3(0.0,0.0,1.0)

// returns a vec3 color from every pixel requested.
// Generates a BnW Ping on normalized 2d coordinate system
vec3 RadarPing(in vec2 uv, in vec2 center, in float innerTail, 
               in float frontierBorder, in float timeResetSeconds, 
               in float radarPingSpeed, in float fadeDistance)
{
    vec2 diff = center-uv;
    float r = length(diff);
    float time = mod(iTime, timeResetSeconds) * radarPingSpeed;
   
    float circle;
    // r is the distance to the center.
    // circle = BipCenter---//---innerTail---time---frontierBorder
    //illustration
    //https://sketch.io/render/sk-14b54f90080084bad1602f81cadd4d07.jpeg
    circle += smoothstep(time - innerTail, time, r) * smoothstep(time + frontierBorder,time, r);
	circle *= smoothstep(fadeDistance, 0.0, r); // fade to 0 after fadeDistance
        
    return vec3(circle);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    //normalize coordinates 
    vec2 uv = fragCoord.xy / iResolution.xy; //move coordinates to 0..1
    uv = uv.xy*2.; // translate to the center
    uv += vec2(-1.0, -1.0);
    uv.x *= iResolution.x/iResolution.y; //correct the aspect ratio
    
	vec3 color;
    // generate some radar pings
    float fadeDistance = 1.0;
    float resetTimeSec = 4.0;
    float radarPingSpeed = 0.3;
    vec2 greenPing = vec2(-1.0, 0.0);
    vec2 redPing   = vec2( 0.0, 0.0);
    vec2 bluePing  = vec2( 1.0, 0.0);
    color += RadarPing(uv, greenPing, 0.25, 0.025, resetTimeSec, radarPingSpeed, fadeDistance) * green;
    color += RadarPing(uv, redPing, .01, 0.01, resetTimeSec, radarPingSpeed, fadeDistance) * red;
    color += RadarPing(uv, bluePing, .01, 0.5, resetTimeSec, radarPingSpeed, fadeDistance) * blue;
    
    //return the new color
	fragColor = vec4(color,1.0);
}


#define green vec3(0.0,.3,0.6)

// returns a vec3 color from every pixel requested.
// Generates a BnW Ping on normalized 2d coordinate system
vec3 RadarPing(in vec2 uv, in vec2 center, in float innerTail, 
               in float frontierBorder, in float timeResetSeconds, 
               in float radarPingSpeed, in float fadeDistance, float t)
{
    vec2 diff = center-uv;
    float r = length(diff);
    float time = mod(t, timeResetSeconds) * radarPingSpeed;
   
    float circle;
    // r is the distance to the center.
    // circle = BipCenter---//---innerTail---time---frontierBorder
    //illustration
    //https://sketch.io/render/sk-14b54f90080084bad1602f81cadd4d07.jpeg
    circle += smoothstep(time - innerTail, time, r) * smoothstep(time + frontierBorder,time, r);
	circle *= smoothstep(fadeDistance, 0.0, r); // fade to 0 after fadeDistance
        
    return vec3(circle);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    //normalize coordinates 
    vec2 uv = fragCoord.xy / iResolution.xy; //move coordinates to 0..1
    uv = uv.xy*2.; // translate to the center
    uv += vec2(-1.0, -1.0);
    uv.x *= iResolution.x/iResolution.y; //correct the aspect ratio
    
	vec3 color;
    // generate some radar pings
    float fadeDistance = 0.8;
    float resetTimeSec = 3.0;
    float radarPingSpeed = 0.2;
    vec2 greenPing = vec2(0.0, 0.0);
    color += RadarPing(uv, greenPing, 0.08, 0.00025, resetTimeSec, radarPingSpeed, fadeDistance, iTime) * green;
    color += RadarPing(uv, greenPing, 0.08, 0.00025, resetTimeSec, radarPingSpeed, fadeDistance, iTime + 1.) * green;
    color += RadarPing(uv, greenPing, 0.08, 0.00025, resetTimeSec, radarPingSpeed, fadeDistance, iTime + 2.) * green;
    //return the new color
	fragColor = vec4(color,1.0);
}

