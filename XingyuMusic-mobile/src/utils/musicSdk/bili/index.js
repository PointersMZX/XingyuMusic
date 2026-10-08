import musicSearch from './musicSearch'
import musicInfo from './musicInfo'

const bili = {
  musicSearch,
  musicInfo,
  getMusicDetailPageUrl(songInfo) {
    return `https://www.bilibili.com/video/${songInfo.songmid}`
  },
}

export default bili
