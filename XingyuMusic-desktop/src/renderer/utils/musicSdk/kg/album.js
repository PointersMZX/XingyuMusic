import { getMusicInfosByList } from './musicInfo'
import { createHttpFetch } from './util'

export default {
  /**
   * 按关键词搜索专辑（kugou，实测可用）
   * @param {*} text
   * @param {*} page
   * @param {*} limit
   */
  search(text, page = 1, limit = 30) {
    const url = `http://msearch.kugou.com/api/v3/search/album?keyword=${encodeURIComponent(text)}&page=${page}&pagesize=${limit}&type=0`
    return createHttpFetch(url).then(body => {
      if (!body || body.status != 1 || !body.data) return Promise.reject(new Error('kg album search failed'))
      const raw = body.data.info || []
      const list = raw.map(item => ({
        source: 'kg',
        id: String(item.albumid),
        name: item.albumname || '',
        author: item.singername || '',
        img: item.imgurl || null,
        desc: item.intro || '',
        publishDate: item.pubtime ? new Date(item.pubtime * 1000).toISOString().slice(0, 10) : null,
        playCount: null,
      }))
      const total = body.data.total || 0
      return {
        source: 'kg',
        list,
        page,
        limit,
        total,
        allPage: Math.max(1, Math.ceil(total / limit)),
      }
    })
  },
  /**
   * 通过AlbumId获取专辑信息
   * @param {*} id
   */
  async getAlbumInfo(id) {
    const albumInfoRequest = await createHttpFetch('http://kmrserviceretry.kugou.com/container/v1/album?dfid=1tT5He3kxrNC4D29ad1MMb6F&mid=22945702112173152889429073101964063697&userid=0&appid=1005&clientver=11589', {
      method: 'POST',
      body: {
        appid: 1005,
        clienttime: 1681833686,
        clientver: 11589,
        data: [{ album_id: id }],
        fields: 'language,grade_count,intro,mix_intro,heat,category,sizable_cover,cover,album_name,type,quality,publish_company,grade,special_tag,author_name,publish_date,language_id,album_id,exclusive,is_publish,trans_param,authors,album_tag',
        isBuy: 0,
        key: 'e6f3306ff7e2afb494e89fbbda0becbf',
        mid: '22945702112173152889429073101964063697',
        show_album_tag: 0,
      },
    })
    if (!albumInfoRequest) return Promise.reject(new Error('get album info failed.'))
    const albumInfo = albumInfoRequest[0]

    return {
      name: albumInfo.album_name,
      image: albumInfo.sizable_cover.replace('{size}', 240),
      desc: albumInfo.intro,
      authorName: albumInfo.author_name,
      // play_count: this.formatPlayCount(info.count),
    }
  },
  /**
   * 通过AlbumId获取专辑
   * @param {*} id
   * @param {*} page
   */
  async getAlbumDetail(id, page = 1, limit = 200) {
    const albumList = await createHttpFetch(`http://mobiles.kugou.com/api/v3/album/song?version=9108&albumid=${id}&plat=0&pagesize=${limit}&area_code=0&page=${page}&with_res_tag=0`)
    if (!albumList.info) return Promise.reject(new Error('Get album list failed.'))

    let result = await getMusicInfosByList(albumList.info)

    const info = await this.getAlbumInfo(id)

    return {
      list: result || [],
      page,
      limit,
      total: albumList.total,
      source: 'kg',
      info: {
        name: info.name,
        img: info.image,
        desc: info.desc,
        author: info.authorName,
        // play_count: this.formatPlayCount(info.count),
      },
    }
  },
}
