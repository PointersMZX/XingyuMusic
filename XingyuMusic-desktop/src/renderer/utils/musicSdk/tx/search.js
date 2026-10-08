import { signRequest } from './utils'

// QQ 音乐关键词检索：复用已可用的签名请求（musics.fcg + zzcSign），
// 走 music.search.SearchCgiService / DoSearchForQQMusicDesktop，按 search_type 取对应分类。
const comm = {
  _channelid: '0',
  _os_version: '6.2.9200-2',
  ct: '19',
  cv: '2151',
  guid: '1F70E520B2EAA7D25E11760783C53CA9',
  patch: '118',
  psrf_access_token_expiresAt: 0,
  psrf_qqaccess_token: '',
  psrf_qqopenid: '',
  psrf_qqunionid: '',
  tmeAppID: 'qqmusic',
  tmeLoginType: 0,
  uin: '0',
  wid: '7223299733393904640',
}

const getSearchId = () => {
  let guid = ''
  for (let i = 0; i < 32; i++) guid += Math.floor(Math.random() * 16).toString(16)
  return guid.toUpperCase() + String(Math.floor(Math.random() * 100000)).padStart(5, '0')
}

const doSearch = (text, page, limit, searchType) => {
  return signRequest({
    comm,
    'music.search.SearchCgiService': {
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicDesktop',
      param: {
        grp: 1,
        num_per_page: limit,
        page_num: page,
        query: text,
        remoteplace: 'txt.newclient.top',
        search_type: searchType,
        searchid: getSearchId(),
      },
    },
  }).then(({ body }) => {
    const res = body?.['music.search.SearchCgiService']
    if (!res || res.code != 0) return Promise.reject(new Error('tx search failed'))
    return res.data || {}
  })
}

export default {
  /**
   * 歌手检索（search_type 3）
   */
  searchSinger(text, page = 1, limit = 30) {
    return doSearch(text, page, limit, 3).then(data => {
      const raw = data.body?.singer?.list || []
      const list = raw.map(item => ({
        source: 'tx',
        id: item.singer_mid || String(item.singerid ?? ''),
        name: item.name || '',
        country: null,
        avatar: item.headpic || null,
        desc: '',
        songCount: item.song_num ?? null,
        albumCount: item.album_num ?? null,
      }))
      const total = data.body?.singer?.total ?? 0
      return { source: 'tx', list, page, limit, total, allPage: Math.max(1, Math.ceil(total / limit)) }
    })
  },
  /**
   * 专辑检索（search_type 5）
   */
  searchAlbum(text, page = 1, limit = 30) {
    return doSearch(text, page, limit, 5).then(data => {
      const raw = data.body?.album?.list || []
      const list = raw.map(item => ({
        source: 'tx',
        id: item.albumMID || String(item.albumID ?? ''),
        name: item.albumName || '',
        author: (item.singerlist || []).map(s => s.name).filter(Boolean).join('、'),
        img: item.albumPic ? item.albumPic.replace('http://', 'https://') : null,
        desc: '',
        publishDate: item.albumTime ? String(item.albumTime).slice(0, 10) : null,
        playCount: null,
      }))
      const total = data.body?.album?.total ?? 0
      return { source: 'tx', list, page, limit, total, allPage: Math.max(1, Math.ceil(total / limit)) }
    })
  },
  /**
   * MV 检索（search_type 14）
   */
  searchMv(text, page = 1, limit = 30) {
    return doSearch(text, page, limit, 14).then(data => {
      const raw = data.body?.mv?.list || []
      const list = raw.map(item => {
        const mid = item.mv_mid || item.vid || ''
        return {
          source: 'tx',
          id: mid || String(item.mv_id ?? ''),
          name: item.title || item.mv_name || '',
          singer: (item.singerlist || []).map(s => s.name).filter(Boolean).join('、'),
          img: item.mv_pic_url ? item.mv_pic_url.replace('http://', 'https://') : null,
          pageUrl: mid ? `https://y.qq.com/n/yqq/mv/v/${mid}.html` : '',
          duration: item.duration ? `${Math.trunc(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : null,
        }
      })
      const total = data.body?.mv?.total ?? 0
      return { source: 'tx', list, page, limit, total, allPage: Math.max(1, Math.ceil(total / limit)) }
    })
  },
}
