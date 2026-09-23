// XingyuMusic · LiquidGlass 着色器
// 移植自 Metric v1.4.3 液态玻璃（Compose RuntimeShaderEffect，从 classes.dex 抽取）：
// - s5/s6：SDF 圆角矩形折射（circleMap 位移场 + 梯度方向）+ 7 色色散（红橙黄绿青蓝紫 7 tap）
// - s3：SDF 边缘光（梯度 · 光向量的幂次锐化，随时间缓慢摆动的"液态流光"）
// - s1：指针径向高光（smoothstep 衰减）
// Compose shader 语言 → WebGL1 GLSL（content 采样 = 主题背景栅格纹理）

export const vertexSrc = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

export const fragmentSrc = `
precision highp float;
varying vec2 v_uv;

uniform sampler2D u_content;
// 面板几何（CSS px）
uniform vec2 u_panelSize;
uniform float u_radius;
// 背景纹理（#root 窗口内容区）
uniform vec2 u_windowSize;
uniform vec2 u_panelPos;
// 折射（Metric s5 参数）
uniform float u_refractionHeight;
uniform float u_refractionAmount;
uniform float u_depthEffect;
// 色散（Metric s6 参数）
uniform float u_chromatic;
// 光效
uniform float u_edgeFalloff;
uniform vec4 u_edgeColor;   // 边缘流光（金色发丝）
uniform vec4 u_tint;        // 玻璃染色
uniform vec4 u_base;        // 玻璃底板
uniform vec4 u_glowColor;   // 指针高光色
uniform vec2 u_pointer;     // 面板局部坐标（CSS px）
uniform float u_pointerA;   // 指针在场强度 0..1
uniform float u_sheen;      // 顶部镜面光强度
uniform float u_time;

// SDF：圆角矩形（Metric s2 同款）
float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

vec2 gradSdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 c = abs(p) - (b - r);
  if (c.x >= 0.0 || c.y >= 0.0) {
    return sign(p) * normalize(max(c, 0.0));
  } else {
    float gx = step(c.y, c.x);
    return sign(p) * vec2(gx, 1.0 - gx);
  }
}

// Metric s5：circleMap 折射位移
float circleMap(float x) {
  return 1.0 - sqrt(max(0.0, 1.0 - x * x));
}

void main() {
  vec2 halfSize = u_panelSize * 0.5;
  vec2 css = v_uv * u_panelSize;
  vec2 centered = css - halfSize;

  float sd = sdRoundedRect(centered, halfSize, u_radius);
  float coverage = smoothstep(0.0, 2.0, -sd);
  if (coverage <= 0.0001) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // ---------- 折射 + 7 色色散（Metric s6 原式：refractedCoord = coord + d*grad；tap 在 refractedCoord ± dispersedCoord） ----------
  vec2 dispDir = vec2(0.0);
  if (-sd < u_refractionHeight) {
    sd = min(sd, 0.0);
    float d = circleMap(1.0 - -sd / u_refractionHeight) * u_refractionAmount;
    float gr = min(u_radius * 1.5, min(halfSize.x, halfSize.y));
    vec2 grad = normalize(gradSdRoundedRect(centered, halfSize, gr) + u_depthEffect * normalize(centered + vec2(0.001)));
    dispDir = d * grad;
  }
  // 色散强度：Metric 原式 (centered.x*centered.y)/(halfSize.x*halfSize.y) —— 四角最强、四边中点为 0
  float ds = u_chromatic * (centered.x * centered.y) / (halfSize.x * halfSize.y);
  vec2 off = dispDir * ds;

  float uvA = 1.0 / u_windowSize.x;
  float uvB = 1.0 / u_windowSize.y;

  vec4 col = vec4(0.0);
  // red：refractedCoord + dispersedCoord
  vec4 red = texture2D(u_content, (u_panelPos + css + dispDir + off) * vec2(uvA, uvB));
  col.r += red.r / 3.5;
  col.a += red.a / 7.0;
  // orange：+2/3 off
  vec4 orange = texture2D(u_content, (u_panelPos + css + dispDir + off * (2.0 / 3.0)) * vec2(uvA, uvB));
  col.r += orange.r / 3.5;
  col.g += orange.g / 7.0;
  col.a += orange.a / 7.0;
  // yellow：+1/3 off
  vec4 yellow = texture2D(u_content, (u_panelPos + css + dispDir + off * (1.0 / 3.0)) * vec2(uvA, uvB));
  col.r += yellow.r / 3.5;
  col.g += yellow.g / 3.5;
  col.a += yellow.a / 7.0;
  // green：refractedCoord（无额外色散）
  vec4 green = texture2D(u_content, (u_panelPos + css + dispDir) * vec2(uvA, uvB));
  col.g += green.g / 3.5;
  col.a += green.a / 7.0;
  // cyan：-1/3 off
  vec4 cyan = texture2D(u_content, (u_panelPos + css + dispDir - off * (1.0 / 3.0)) * vec2(uvA, uvB));
  col.g += cyan.g / 3.5;
  col.b += cyan.b / 3.0;
  col.a += cyan.a / 7.0;
  // blue：-2/3 off
  vec4 blue = texture2D(u_content, (u_panelPos + css + dispDir - off * (2.0 / 3.0)) * vec2(uvA, uvB));
  col.b += blue.b / 3.0;
  col.a += blue.a / 7.0;
  // purple：-off
  vec4 purple = texture2D(u_content, (u_panelPos + css + dispDir - off) * vec2(uvA, uvB));
  col.r += purple.r / 7.0;
  col.b += purple.b / 3.0;
  col.a += purple.a / 7.0;

  // ---------- 玻璃体：染色 + 底板 ----------
  float shadeMix = clamp(u_tint.a * 1.7, 0.0, 1.0);
  vec3 shade = mix(vec3(1.0), u_tint.rgb, shadeMix);
  vec3 rgb = col.rgb * shade + u_base.rgb * u_base.a;

  // 液态微光（缓慢呼吸，让玻璃"活着"）
  float caustic = 0.03 * (0.5 + 0.5 * sin(u_time * 0.6 + css.x * 0.045 + css.y * 0.09));
  rgb += caustic * u_edgeColor.rgb * u_edgeColor.a;

  // ---------- SDF 边缘光（Metric s3）：流光方向随时间摆动 ----------
  float ang = 1.5708 + 0.42 * sin(u_time * 0.21);
  float gr2 = min(u_radius * 1.5, min(halfSize.x, halfSize.y));
  vec2 g2 = normalize(gradSdRoundedRect(centered, halfSize, gr2));
  vec2 nrm = vec2(cos(ang), sin(ang));
  float dl = dot(g2, nrm);
  float lightUp = step(0.0, dl);
  float rim = pow(abs(dl), u_edgeFalloff) * u_edgeColor.a * lightUp;
  vec3 lightCol = mix(u_edgeColor.rgb, vec3(1.0), 0.4);
  rgb += lightCol * rim;

  // 顶部镜面光
  float sheen = (1.0 - smoothstep(0.0, 1.0, css.y / max(u_panelSize.y, 1.0))) * u_sheen;
  rgb += u_edgeColor.rgb * sheen * 0.55;

  // ---------- 指针高光（Metric s1） ----------
  float gd = distance(css, u_pointer);
  float glow = (1.0 - smoothstep(45.0, 110.0, gd)) * u_pointerA;
  rgb += u_glowColor.rgb * glow * u_glowColor.a;

  // ---------- 合成 ----------
  float alpha = coverage * clamp(u_base.a + u_tint.a * 0.55 + rim * 0.5 + sheen * 0.4 + glow * 0.5, 0.0, 0.98);
  gl_FragColor = vec4(rgb, alpha);
}
`
