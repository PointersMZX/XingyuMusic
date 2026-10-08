import { httpFetch } from '../../request'
import { createHttpFetch } from './utils'
import { filterMusicInfoList } from './musicInfo'
import { formatPlayCount } from '../../index'
import { createSignature } from './musicSearch'

export default {
  limit: 20,
  /**
   * 按关键词搜索专辑
   * @param {*} text
   * @param {*} page
   * @param {*} limit
   */
  search(text, page = 1, limit = this.limit, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    const time = Date.now().toString()
    const signData = createSignature(time, text)
    const url = `https://jadeite.migu.cn/music_search/v3/search/searchAll?isCorrect=0&isCopyright=1&searchSwitch=${encodeURIComponent('{"song":0,"album":1,"singer":0}')}&pageSize=${limit}&text=${encodeURIComponent(text)}&pageNo=${page}&sort=0&sid=USS`
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
      const rd = body.albumResultData || {}
      const list = (rd.result || []).map(item => ({
        source: 'mg',
        id: String(item.id),
        name: item.name || '',
        author: item.singer || '',
        img: item.imgItems && item.imgItems.length ? item.imgItems[0].img : null,
        desc: item.desc || '',
        publishDate: item.publishDate || null,
        playCount: null,
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
    })
  },
  /**
   * 通过AlbumId获取专辑
   * @param {*} id
   * @param {*} page
   */
  async getAlbumDetail(id, page = 1) {
    const list = await createHttpFetch(`http://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/queryAlbumSong?albumId=${id}&pageNo=${page}`)
    if (!list.songList) return Promise.reject(new Error('Get album list error.'))

    const songList = filterMusicInfoList(list.songList)
    const listInfo = await this.getAlbumInfo(id)

    return {
      list: songList || [],
      page,
      limit: listInfo.total,
      total: listInfo.total,
      source: 'mg',
      info: {
        name: listInfo.name,
        img: listInfo.image,
        desc: listInfo.desc,
        author: listInfo.author,
        play_count: listInfo.play_count,
      },
    }
  },
  /**
   * 通过AlbumId获取专辑信息
   * @param {*} id
   * @param {*} page
   */
  async getAlbumInfo(id) {
    const info = await createHttpFetch(`https://app.c.nf.migu.cn/MIGUM3.0/resource/album/v2.0?albumId=${id}`)
    if (!info) return Promise.reject(new Error('Get album info error.'))

    return {
      name: info.title,
      image: info.imgItems.length ? info.imgItems[0].img : null,
      desc: info.summary,
      author: info.singer,
      play_count: formatPlayCount(info.opNumItem.playNum),
      total: info.totalCount,
    }
  },
}
