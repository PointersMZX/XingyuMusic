import { httpFetch } from '../../request'
import { toMD5 } from '../utils'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const MIXIN_KEY_CACHE = [46, 47, 18, 2, 52, 23, 33, 16, 51, 31, 60, 42, 39, 8, 27, 30, 75, 41, 6, 34, 17, 0, 76, 3, 63, 58, 48, 35, 64, 1, 62, 24, 95, 21, 94, 25, 19, 91, 71, 50, 66, 79, 37, 99, 20, 83, 26, 55, 88, 9, 97, 38, 92, 90, 44, 74, 11, 72, 59, 84, 53, 85, 96, 101, 22, 78, 67, 29, 14, 73, 70, 82, 93, 100, 32, 61, 45, 77, 15, 81, 28, 12, 87, 40, 89, 13, 65, 8, 86]

let biliCookie = null
let biliWbiKey = null

const biliHeaders = (referer = 'https://www.bilibili.com/') => ({
  'User-Agent': UA,
  Referer: referer,
  ...(biliCookie ? { Cookie: biliCookie } : {}),
})

/**
 * 获取 WBI key（spi 取匿名 buvid → nav 取 wbi_img → mixinKey）
 */
export const getWbiKey = async() => {
  if (biliWbiKey) return biliWbiKey
  const spiRequest = httpFetch('https://api.bilibili.com/x/frontend/finger/spi', {
    headers: biliHeaders(),
  })
  const spi = await spiRequest.promise.then(({ statusCode, body }) => {
    if (statusCode !== 200 || !body || body.code !== 0) return null
    return body.data
  })
  if (!spi || (!spi.b_3 && !spi.b_4)) throw new Error('bili buvid fetch failed')
  biliCookie = `buvid3=${spi.b_3}; buvid4=${spi.b_4}`

  const navRequest = httpFetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: biliHeaders(),
  })
  const nav = await navRequest.promise.then(({ statusCode, body }) => {
    if (statusCode !== 200 || !body || body.code !== 0) throw new Error('bili nav fetch failed')
    return body.data
  })
  const wbiImg = nav.wbi_img || {}
  const imgKey = (wbiImg.img_url || '').split('/').pop().replace('.png', '')
  const subKey = (wbiImg.sub_url || '').split('/').pop().replace('.png', '')
  if (!imgKey || !subKey) throw new Error('bili wbi key fetch failed')
  const merged = (imgKey + subKey).slice(0, 32)
  let wbiKey = ''
  for (let i = 0; i < 32; i++) {
    wbiKey += String.fromCharCode((merged.charCodeAt(i) + MIXIN_KEY_CACHE[i]) & 0xff)
  }
  if (!biliWbiKey) biliWbiKey = wbiKey
  return biliWbiKey
}

/**
 * 带 WBI 签名的 web-interface 请求（playurl 等）
 * @param {*} path web-interface 下的接口名
 * @param {*} params 请求参数
 * @param {*} referer
 */
export const biliWbiRequest = async(path, params = {}, referer = 'https://www.bilibili.com/') => {
  const wbiKey = await getWbiKey()
  const signParams = { ...params, wts: String(Math.floor(Date.now() / 1000)) }
  const signRaw = Object.keys(signParams)
    .sort()
    .map(k => `${k.replace(/[^a-zA-Z0-9=_-]/g, '')}=${String(signParams[k]).replace(/[^a-zA-Z0-9=_-]/g, '')}`)
    .join('&')
  signParams.w_rid = toMD5(signRaw + wbiKey)

  const url = `https://api.bilibili.com/x/web-interface/wbi/${path}?` + Object.entries(signParams)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    .join('&')
  const request = httpFetch(url, { headers: biliHeaders(referer) })
  return request.promise.then(({ statusCode, body }) => {
    if (statusCode !== 200 || !body || body.code !== 0) {
      return Promise.reject(new Error('bili wbi request failed: ' + (body?.code ?? statusCode)))
    }
    return body.data
  })
}
