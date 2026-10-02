// Node 16（Electron 22 / Win7 版）缺失的 Node 18+ 全局量 polyfill。
// Node 18+ 已内置这些全局量，下面的守卫会直接跳过（零副作用），
// 所以本模块可以「始终」被主进程引入，仅对 Node 16 生效。
// 用途：undici@7 在主进程加载时引用 ReadableStream / Blob / File 等 Node 18+ 全局量，
// 放到 Node 16（E22）会抛 ReferenceError。这里用 stream/web + buffer + events 兜底。
try {
  const web = require('stream/web')
  if (typeof globalThis.ReadableStream === 'undefined' && web.ReadableStream) globalThis.ReadableStream = web.ReadableStream
  if (typeof globalThis.WritableStream === 'undefined' && web.WritableStream) globalThis.WritableStream = web.WritableStream
  if (typeof globalThis.TransformStream === 'undefined' && web.TransformStream) globalThis.TransformStream = web.TransformStream
} catch (_e) { /* 非 Node 环境 / 已内置时忽略 */ }

try {
  const { Blob, File } = require('buffer')
  if (typeof globalThis.Blob === 'undefined' && Blob) globalThis.Blob = Blob
  // Node 16 的 buffer 没有 File，用 Blob 兜一个最小实现（undici 等库仅按 Blob 接口使用）
  if (typeof globalThis.File === 'undefined') {
    globalThis.File = File || class File extends (globalThis.Blob || Object) {
      constructor(bits, name, options) {
        super(bits, options)
        this.name = name
        this.lastModified = options && options.lastModified ? options.lastModified : Date.now()
      }
    }
  }
} catch (_e) { /* 忽略 */ }

try {
  const events = require('events')
  if (typeof globalThis.CloseEvent === 'undefined' && events.CloseEvent) globalThis.CloseEvent = events.CloseEvent
  if (typeof globalThis.CustomEvent === 'undefined' && events.CustomEvent) globalThis.CustomEvent = events.CustomEvent
  if (typeof globalThis.MessageEvent === 'undefined' && events.MessageEvent) globalThis.MessageEvent = events.MessageEvent
} catch (_e) { /* 忽略 */ }

if (typeof globalThis.structuredClone === 'undefined') {
  // 简易深拷贝兜底（本项目用到的均为可 JSON 化数据）
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj))
}

if (typeof globalThis.DOMException === 'undefined') {
  // Node 16 无 DOMException 全局（Node 17+ 才有），给个最小实现
  globalThis.DOMException = class DOMException extends Error {
    constructor(message, name = 'Error') {
      super(message)
      this.name = name
    }
  }
}

// AbortSignal.timeout / AbortSignal.any（Node 17.3+ / 22 才有）
try {
  if (typeof AbortSignal !== 'undefined') {
    if (typeof AbortSignal.timeout === 'undefined') {
      AbortSignal.timeout = (ms) => {
        const ac = new AbortController()
        setTimeout(() => ac.abort(new Error('timeout')), ms)
        return ac.signal
      }
    }
    if (typeof AbortSignal.any === 'undefined') {
      AbortSignal.any = (signals) => {
        const ac = new AbortController()
        for (const s of signals) {
          if (s.aborted) ac.abort(s.reason)
          else s.addEventListener('abort', () => ac.abort(s.reason), { once: true })
        }
        return ac.signal
      }
    }
  }
} catch (_e) { /* 忽略 */ }
