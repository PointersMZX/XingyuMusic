import { httpFetch } from '../../request'
import { decodeName } from '../../index'
import { objStr2JSON } from './util'

const BASE_PIC = 'http://img1.kuwo.cn/star/starheads/'

const cleanDesc = (desc) => {
  if (!desc) return ''
  return String(desc)
    .replace(/&nbsp;/g, ' ')
    .split(/\\n|基本信息/)[0]
    .trim()
    .slice(0, 80)
}

export default {
  /**
   * 按关键词搜索歌手
   * @param {*} text
   * @param {*} page
   * @param {*} limit
   */
  search(text, page = 1, limit = 20) {
    const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(text)}&pn=${page - 1}&rn=${limit}&uid=794762570&ver=kwplayer_ar_9.2.2.1&ft=artist&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&newver=1&vipver=1&show_copyright_off=1`
    return httpFetch(url).promise.then(({ statusCode, body }) => {
      if (statusCode !== 200) return Promise.reject(new Error('kw singer search failed'))
      body = objStr2JSON(body)
      const raw = body.abslist || []
      const list = raw.map(item => ({
        source: 'kw',
        id: String(item.ARTISTID ?? item.DC_TARGETID ?? ''),
        name: decodeName(item.ARTIST) || '',
        country: decodeName(item.COUNTRY) || null,
        avatar: item.PICPATH ? BASE_PIC + item.PICPATH : null,
        desc: cleanDesc(item.desc),
        songCount: parseInt(item.SONGNUM) || 0,
        albumCount: parseInt(item.ALBUMNUM) || 0,
      }))
      const total = parseInt(body.TOTAL) || 0
      return {
        source: 'kw',
        list,
        page,
        limit,
        total,
        allPage: Math.max(1, Math.ceil(total / limit)),
      }
    })
  },
}
