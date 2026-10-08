import { httpFetch } from '../../request'
import { createSignature } from './musicSearch'

export default {
  limit: 20,

  /**
   * 按关键词搜索歌手
   * @param {*} text
   * @param {*} page
   * @param {*} limit
   */
  search(text, page = 1, limit = this.limit, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    const time = Date.now().toString()
    const signData = createSignature(time, text)
    const url = `https://jadeite.migu.cn/music_search/v3/search/searchAll?isCorrect=0&isCopyright=1&searchSwitch=${encodeURIComponent('{"song":0,"album":0,"singer":1}')}&pageSize=${limit}&text=${encodeURIComponent(text)}&pageNo=${page}&sort=0&sid=USS`
    const searchRequest = httpFetch(url, {
      headers: {
        uiVersion: 'A_music_3.6.1',
        deviceId: signData.deviceId,
        timestamp: time,
        sign: signData.sign,
        channel: '0146921',
        'User-Agent': 'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
      },
    })
    return searchRequest.promise.then(({ statusCode, body }) => {
      if (statusCode !== 200) return this.search(text, page, limit, retryNum)
      const rd = body.singerResultData || {}
      const list = (rd.result || []).map(item => ({
        source: 'mg',
        id: String(item.id),
        name: item.name || '',
        country: null,
        avatar: item.singerPicUrl && item.singerPicUrl.length ? item.singerPicUrl[0].img : null,
        desc: item.desc || '',
        songCount: item.songCount || 0,
        albumCount: item.albumCount || 0,
      }))
      const total = rd.totalCount || 0
      return {
        source: 'mg',
        list,
        page,
        limit,
        total,
        allPage: Math.max(1, Math.ceil(total / limit)),
      }
    }).catch(err => {
      if (err && err.message === 'try max num') throw err
      return this.search(text, page, limit, retryNum)
    })
  },
}
