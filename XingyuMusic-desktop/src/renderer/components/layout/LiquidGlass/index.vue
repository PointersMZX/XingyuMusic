<template>
  <canvas ref="canvas" class="liquid-glass-canvas" aria-hidden="true"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { vertexSrc, fragmentSrc } from './shaders.js'

// variant = 'player'（底栏，招牌效果）| 'toolbar'（顶栏，轻一点）
// 参数偏强：让折射位移 / 7 色色散 / 边缘流光在默认紫金黑背景下清晰可见（"液态"感）
const VARIANT_PARAMS = {
  player: {
    radius: 14,
    refractionHeight: 40,
    refractionAmount: 10,
    depthEffect: 0.3,
    chromatic: 2.2,
    edgeFalloff: 2.4,
    sheen: 0.85,
    glow: 1.4,
    blur: 2.5,
  },
  toolbar: {
    radius: 10,
    refractionHeight: 26,
    refractionAmount: 6,
    depthEffect: 0.22,
    chromatic: 1.6,
    edgeFalloff: 2.8,
    sheen: 0.7,
    glow: 1.1,
    blur: 2,
  },
}

const props = defineProps({
  target: {
    type: String,
    default: '#player',
  },
  variant: {
    type: String,
    default: 'player',
  },
})

const canvas = ref(null)
const param = VARIANT_PARAMS[props.variant] || VARIANT_PARAMS.player

// ---------- 颜色解析 ----------
const parseColor = (str, fallback = [0, 0, 0, 0]) => {
  if (!str) return fallback
  str = str.trim()
  if (str == 'transparent' || str == 'none') return [0, 0, 0, 0]
  let m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(str)
  if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, m[4] == null ? 1 : Number(m[4])]
  m = /^#([0-9a-f]{8})$/i.exec(str)
  if (m) {
    const n = parseInt(m[1], 16)
    return [((n >> 24) & 255) / 255, ((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  m = /^#([0-9a-f]{6})$/i.exec(str)
  if (m) {
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 0xff, ((n >> 8) & 0xff), (n & 0xff), 255].map(v => v / 255)
  }
  m = /^#([0-9a-f]{3})$/i.exec(str)
  if (m) {
    const r = parseInt(m[1][0] + m[1][0], 16) / 255
    const g = parseInt(m[1][1] + m[1][1], 16) / 255
    const b = parseInt(m[1][2] + m[1][2], 16) / 255
    return [r, g, b, 1]
  }
  return fallback
}

// 计算层背景颜色：#root（主题内容背景 + 背景图）+ #container（app 背景）+ #right（main 背景）
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// 分割 CSS 多层 background 值（顶层逗号）
const splitLayers = (s) => {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch == '(') depth++
    else if (ch == ')') depth--
    if (ch == ',' && depth == 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
const splitStops = (s) => {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch == '(') depth++
    else if (ch == ')') depth--
    if (ch == ',' && depth == 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

// 画一个 radial-gradient 层：'radial-gradient(1100px 700px at 18% -10%, c1, c2)'
const paintRadial = (ctx, layer, W, H) => {
  let m = /radial-gradient\((.*)\)\s*$/s.exec(layer)
  if (!m) return
  const inner = m[1]
  // 定位 'at'（顶层，不在括号里）
  let atDepth = 0
  let atIdx = -1
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch == '(') atDepth++
    else if (ch == ')') atDepth--
    else if (atDepth == 0 && ch == 'a' && inner.slice(i, i + 3) == 'at ') atIdx = i
  }
  let head = inner
  let posStr = ''
  if (atIdx > -1) {
    head = inner.slice(0, atIdx)
    posStr = inner.slice(atIdx + 3)
    atDepth = 0
    let firstComma = -1
    for (let i = posStr.length - 1; i >= 0; i--) {
      const ch = posStr[i]
      if (ch == ')') atDepth++
      else if (ch == '(') atDepth--
      else if (ch == ',' && atDepth == 0) { firstComma = i; break }
    }
    if (firstComma > -1) posStr = posStr.slice(0, firstComma)
  }
  let stopsStr = inner
  const commaAfterAt = atIdx > -1 ? inner.indexOf(',', atIdx) : inner.indexOf(',')
  if (commaAfterAt > -1) stopsStr = inner.slice(commaAfterAt + 1)

  // 位置
  let cx = W * 0.5
  let cy = H * 0.5
  const posTokens = posStr.trim().split(/\s+/)
  if (posTokens.length >= 2) {
    cx = /%$/.test(posTokens[posTokens.length - 2]) ? Number(posTokens[posTokens.length - 2]) / 100 * W : Number(posTokens[posTokens.length - 2])
    cy = /%$/.test(posTokens[posTokens.length - 1]) ? Number(posTokens[posTokens.length - 1]) / 100 * H : Number(posTokens[posTokens.length - 1])
  }
  // 尺寸（'1100px 700px' 椭圆）
  const sizeTokens = head.split(/\s+/).filter(t => t.endsWith('px'))
  let rx = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 0.8
  let ry = rx
  if (sizeTokens.length >= 1) rx = Number(sizeTokens[0]) || rx
  if (sizeTokens.length >= 2) ry = Number(sizeTokens[1]) || ry
  if (rx < 1) rx = 1

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  const stops = splitStops(stopsStr)
  for (let i = 0; i < stops.length; i++) {
    const sm = /^(rgba?\([^)]*\)|#[0-9a-fA-F]+|transparent)\s*([\d.]+%?)?$/.exec(stops[i].trim())
    let offset = sm?.[2] ? Number(sm[2].replace('%', '')) / 100 : i / Math.max(stops.length - 1, 1)
    let color = sm ? sm[1] : stops[i].trim()
    if (color == 'transparent') color = 'rgba(0,0,0,0)'
    g.addColorStop(Math.min(Math.max(offset, 0), 1), color)
  }
  ctx.fillStyle = g
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2)
  ctx.restore()
}

// 画一个 linear-gradient 层：'linear-gradient(180deg, c1, c2)'
const paintLinear = (ctx, layer, W, H) => {
  let m = /linear-gradient\((.*)\)\s*$/s.exec(layer)
  if (!m) return
  const inner = m[1]
  let depth = 0
  let firstComma = -1
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch == '(') depth++
    else if (ch == ')') depth--
    else if (ch == ',' && depth == 0) { firstComma = i; break }
  }
  const head = (firstComma > -1 ? inner.slice(0, firstComma) : inner).trim()
  const stopsStr = firstComma > -1 ? inner.slice(firstComma + 1) : ''
  let angleDeg = 180
  const dirM = /to\s+(right|left|top|bottom)|(-?[\d.]+)deg/.exec(head)
  if (dirM) {
    if (dirM[1] == 'right') angleDeg = 90
    else if (dirM[1] == 'left') angleDeg = 270
    else if (dirM[1] == 'top') angleDeg = 0
    else if (dirM[2] != null) angleDeg = Number(dirM[2])
  }
  const a = angleDeg * Math.PI / 180
  const dx = Math.sin(a)
  const dy = -Math.cos(a)
  const len = Math.abs(W * dx) + Math.abs(H * dy) || 1
  const x0 = W / 2 - dx * len / 2
  const y0 = H / 2 - dy * len / 2
  const g = ctx.createLinearGradient(x0, y0, x0 + dx * len, y0 + dy * len)
  const stops = splitStops(stopsStr)
  for (let i = 0; i < stops.length; i++) {
    const sm = /^(rgba?\([^)]*\)|#[0-9a-fA-F]+|transparent)\s*([\d.]+%?)?$/.exec(stops[i].trim())
    let offset = sm?.[2] ? Number(sm[2].replace('%', '')) / 100 : i / Math.max(stops.length - 1, 1)
    let color = sm ? sm[1] : stops[i].trim()
    if (color == 'transparent') color = 'rgba(0,0,0,0)'
    g.addColorStop(Math.min(Math.max(offset, 0), 1), color)
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

// 栅格化「玻璃背后」的完整背景堆叠（#root 内容背景+背景图 → #container app 背景 → #right main 背景）
// 返回是否发生变化
let bgCanvas = null
let blurCanvas = null
let bgSig = ''
const bgColorOf = (id) => {
  const el = document.getElementById(id)
  return el ? getComputedStyle(el).backgroundColor : 'rgba(0,0,0,0)'
}
const rasterizeBackground = () => {
  const root = document.getElementById('root')
  if (!root) return false
  const W = root.clientWidth || 1280
  const H = root.clientHeight || 720
  const cs = getComputedStyle(root)
  const appBg = bgColorOf('container')
  const mainBg = bgColorOf('right')
  const sig = [
    W, H,
    cs.backgroundColor,
    cs.backgroundImage,
    appBg,
    mainBg,
  ].join('|')
  if (sig == bgSig && bgCanvas) return false
  bgSig = sig
  if (!bgCanvas) bgCanvas = document.createElement('canvas')
  bgCanvas.width = W
  bgCanvas.height = H
  const ctx = bgCanvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = cs.backgroundColor || 'rgba(0,0,0,0)'
  ctx.fillRect(0, 0, W, H)
  const bgImage = cs.backgroundImage || 'none'
  if (bgImage != 'none' && !bgImage.includes('var(')) {
    for (const layer of splitLayers(bgImage)) {
      if (layer.startsWith('radial-gradient')) paintRadial(ctx, layer, W, H)
      else if (layer.startsWith('linear-gradient')) paintLinear(ctx, layer, W, H)
    }
  }
  if (appBg) {
    ctx.fillStyle = appBg
    ctx.fillRect(0, 0, W, H)
  }
  if (mainBg) {
    ctx.fillStyle = mainBg
    ctx.fillRect(0, 0, W, H)
  }
  // 磨砂（frosted）副本：折射源加轻微高斯模糊，玻璃才有"磨砂折射"的实体感
  if (!blurCanvas) blurCanvas = document.createElement('canvas')
  blurCanvas.width = W
  blurCanvas.height = H
  const bctx = blurCanvas.getContext('2d')
  bctx.clearRect(0, 0, W, H)
  bctx.filter = `blur(${param.blur ?? 2}px)`
  bctx.drawImage(bgCanvas, 0, 0)
  bctx.filter = 'none'
  return true
}

// ---------- WebGL ----------
let gl = null
let prog = null
let uniforms = {}
let contentTex = null

const compile = (type, src) => {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[LiquidGlass] shader compile error:', gl.getShaderInfoLog(s))
    return null
  }
  return s
}

const initGL = () => {
  const c = canvas.value
  if (!c) return false
  gl = c.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, depth: false, stencil: false })
  if (!gl) return false
  const vs = compile(gl.VERTEX_SHADER, vertexSrc)
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc)
  if (!vs || !fs) return false
  prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[LiquidGlass] link error:', gl.getProgramInfoLog(prog))
    return false
  }
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'a_pos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  for (const name of [
    'u_content', 'u_panelSize', 'u_panelPos', 'u_windowSize',
    'u_radius', 'u_refractionHeight', 'u_refractionAmount', 'u_depthEffect', 'u_chromatic',
    'u_edgeFalloff', 'u_edgeColor', 'u_tint', 'u_base', 'u_glowColor',
    'u_pointer', 'u_pointerA', 'u_sheen', 'u_glow', 'u_time',
  ]) {
    uniforms[name] = gl.getUniformLocation(prog, name)
  }
  contentTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, contentTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  gl.uniform1i(uniforms.u_content, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  return true
}

const uploadContentTex = (changed) => {
  // 折射源用磨砂副本（blurCanvas），无则退回清晰底
  const src = blurCanvas || bgCanvas
  if (!gl || !src || !changed) return
  gl.bindTexture(gl.TEXTURE_2D, contentTex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
}

// ---------- 指针 ----------
let pointerX = 0
let pointerY = 0
let smPointerX = 0
let smPointerY = 0
let pointerA = 0
let smPointerA = 0

const onPointerMove = (e) => {
  pointerX = e.clientX
  pointerY = e.clientY
}

// ---------- 主题变量 ----------
let themeVars = null
const readThemeVars = () => {
  const cs = getComputedStyle(document.documentElement)
  const glassEnable = (cs.getPropertyValue('--liquid-glass') || '').trim()
  themeVars = {
    enabled: glassEnable !== 'false',
    edge: parseColor(cssVar('--color-glass-edge'), [0, 0, 0, 0]),
    tint: parseColor(cssVar('--color-glass-tint'), [0, 0, 0, 0]),
    base: parseColor(cssVar('--color-glass-base'), [0, 0, 0, 0]),
  }
}

// ---------- 渲染循环 ----------
let rafId = 0
let lastW = 0
let lastH = 0

const draw = () => {
  rafId = requestAnimationFrame(draw)
  const c = canvas.value
  if (!c || !gl) return

  const target = document.querySelector(props.target)
  const root = document.getElementById('root')
  if (!themeVars) readThemeVars()
  if (!target || !root || !themeVars) {
    if (c.style.display != 'none') c.style.display = 'none'
    syncDomClass(false)
    return
  }

  const visible = themeVars.enabled
  if (!visible) {
    if (c.style.display != 'none') c.style.display = 'none'
    syncDomClass(false)
    return
  }

  const rect = target.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  if (rect.width < 4 || rect.height < 4) {
    c.style.display = 'none'
    syncDomClass(false)
    return
  }

  if (c.style.display == 'none') {
    c.style.display = 'block'
  }
  syncDomClass(true)

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cssW = Math.round(rect.width)
  const cssH = Math.round(rect.height)
  if (cssW != lastW || cssH != lastH) {
    lastW = cssW
    lastH = cssH
    c.width = cssW * dpr
    c.height = cssH * dpr
    gl.viewport(0, 0, c.width, c.height)
  }
  c.style.width = cssW + 'px'
  c.style.height = cssH + 'px'
  c.style.left = Math.round(rect.left) + 'px'
  c.style.top = Math.round(rect.top) + 'px'

  // 背景纹理
  uploadContentTex(rasterizeBackground())

  // 指针（面板局部坐标）
  const localX = pointerX - rect.left
  const localY = pointerY - rect.top
  const inside = localX >= -40 && localX <= rect.width + 40 && localY >= -40 && localY <= rect.height + 40
  pointerA = inside ? 1 : 0
  smPointerX += (Math.min(Math.max(localX, 0), rect.width) - smPointerX) * 0.16
  smPointerY += (Math.min(Math.max(localY, 0), rect.height) - smPointerY) * 0.16
  smPointerA += (pointerA - smPointerA) * 0.1

  const t = performance.now() / 1000
  gl.useProgram(prog)
  gl.bindTexture(gl.TEXTURE_2D, contentTex)
  const pv = param
  gl.uniform2f(uniforms.u_panelSize, rect.width, rect.height)
  gl.uniform1f(uniforms.u_radius, pv.radius)
  gl.uniform2f(uniforms.u_windowSize, root.clientWidth || rect.width * 3, root.clientHeight || rect.height * 3)
  gl.uniform2f(uniforms.u_panelPos, rect.left - rootRect.left, rect.top - rootRect.top)
  gl.uniform1f(uniforms.u_refractionHeight, pv.refractionHeight)
  gl.uniform1f(uniforms.u_refractionAmount, pv.refractionAmount)
  gl.uniform1f(uniforms.u_depthEffect, pv.depthEffect)
  gl.uniform1f(uniforms.u_chromatic, pv.chromatic)
  gl.uniform1f(uniforms.u_edgeFalloff, pv.edgeFalloff)
  gl.uniform4fv(uniforms.u_edgeColor, themeVars.edge)
  gl.uniform4fv(uniforms.u_tint, themeVars.tint)
  gl.uniform4fv(uniforms.u_base, themeVars.base)
  gl.uniform4fv(uniforms.u_glowColor, themeVars.edge)
  gl.uniform2f(uniforms.u_pointer, smPointerX, smPointerY)
  gl.uniform1f(uniforms.u_pointerA, smPointerA)
  gl.uniform1f(uniforms.u_sheen, pv.sheen)
  gl.uniform1f(uniforms.u_glow, pv.glow ?? 1.2)
  gl.uniform1f(uniforms.u_time, t)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

// 多个 LiquidGlass 实例共用同一开关类：引用计数
let domClassCount = 0
let meVisible = false
const syncDomClass = (on) => {
  if (on == meVisible) return
  domClassCount += on ? 1 : -1
  meVisible = on
  if (domClassCount < 0) domClassCount = 0
  document.documentElement.classList.toggle('liquid-glass-on', domClassCount > 0)
}

let themeTimer = 0

onMounted(() => {
  if (!initGL()) {
    // WebGL 不可用：保持 CSS 玻璃兜底（liquid-glass.less 原样）
    canvas.value.style.display = 'none'
    return
  }
  smPointerX = 0
  smPointerY = 0
  window.addEventListener('mousemove', onPointerMove, { passive: true })
  themeTimer = setInterval(readThemeVars, 500)
  rafId = requestAnimationFrame(draw)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  clearInterval(themeTimer)
  window.removeEventListener('mousemove', onPointerMove)
  syncDomClass(false)
})
</script>

<style scoped>
.liquid-glass-canvas {
  position: fixed;
  z-index: 0;
  pointer-events: none;
  display: none;
}
</style>
