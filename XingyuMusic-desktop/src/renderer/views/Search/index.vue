<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <div :class="$style.typeRow">
        <base-tab v-model="searchType" :list="searchTypes" @change="handleTypeChange" />
      </div>
      <div :class="$style.channelRow">
        <base-tab v-model="source" :list="typeSources" @change="handleSourceChange" />
      </div>
    </div>
    <div :class="$style.main">
      <song-list-list v-if="searchType == 'songlist'" v-show="searchText" :page="page" :source-id="source" />
      <singer-list v-else-if="searchType == 'singer'" v-show="searchText" :page="page" :source-id="source" @to-detail="handleSingerDetail" />
      <album-list v-else-if="searchType == 'album'" v-show="searchText" :page="page" :source-id="source" @to-detail="handleAlbumDetail" />
      <lyric-list v-else-if="searchType == 'lyric'" v-show="searchText" :page="page" :source-id="source" />
      <mv-list v-else-if="searchType == 'mv'" v-show="searchText" :page="page" :source-id="source" />
      <music-list v-else v-show="searchText" :page="page" :source-id="source" />
      <blank-view :visible="!searchText" :source="source" />
    </div>
  </div>
</template>

<script>
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { searchText } from '@renderer/store/search/state'
import { getSearchSetting, setSearchSetting } from '@renderer/utils/data'
import { sources as channelSources } from '@renderer/store/search/music'

import MusicList from './MusicList/index.vue'
import SongListList from './SongListList/index.vue'
import SingerList from './SingerList/index.vue'
import AlbumList from './AlbumList/index.vue'
import LyricList from './LyricList/index.vue'
import MvList from './MvList/index.vue'
import BlankView from './components/BlankView.vue'
import { computed, ref } from '@common/utils/vueTools'
import { sourceNames } from '@renderer/store'

const source = ref('all')
const searchType = ref(null)
const page = ref(1)

const normalizeSource = (src) => {
  return channelSources.includes(src) ? src : 'all'
}

const verifyQueryParams = async(to, from, next) => {
  let _source = to.query.source
  let _type = to.query.type
  let _page = to.query.page

  if (_source == null || _type == null) {
    const setting = await getSearchSetting()
    _type ??= setting.type
    _source ??= setting.source
    _source = normalizeSource(_source)

    next({
      path: to.path,
      query: { ...to.query, source: _source, type: _type, page: _page },
    })
    return
  }
  _source = normalizeSource(_source)
  source.value = _source
  searchType.value = _type

  if (_page) page.value = parseInt(_page)

  if (to.query.text != null) {
    searchText.value = to.query.text
    if (!_page) page.value = 1
  }
  next()
  void setSearchSetting({ source: _source, type: _type })
}

export default {
  components: {
    MusicList,
    SongListList,
    SingerList,
    AlbumList,
    LyricList,
    MvList,
    BlankView,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const route = useRoute()
    const router = useRouter()

    // 线路行固定 7 项（综合排最前 + 6 星名），不随分类收窄
    const typeSources = computed(() => {
      return channelSources.map(id => {
        return {
          id,
          label: id == 'all' ? sourceNames.value.all : sourceNames.value[id],
        }
      })
    })
    const handleSourceChange = (id) => {
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          source: id,
          page: 1,
        },
      })
    }

    const searchTypes = computed(() => {
      return [
        { label: window.i18n.t('search__type_music'), id: 'music' },
        { label: window.i18n.t('search__type_singer'), id: 'singer' },
        { label: window.i18n.t('search__type_album'), id: 'album' },
        { label: window.i18n.t('search__type_songlist'), id: 'songlist' },
        { label: window.i18n.t('search__type_lyric'), id: 'lyric' },
        { label: window.i18n.t('search__type_mv'), id: 'mv' },
      ]
    })
    const handleTypeChange = (type) => {
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          type,
          source: source.value,
          page: 1,
        },
      })
    }

    const handleSingerDetail = (item) => {
      void router.push({
        path: '/singerDetail',
        query: {
          source: item.source,
          id: item.id,
          name: item.name,
          avatar: item.avatar || '',
          desc: item.desc || '',
          songCount: item.songCount != null ? String(item.songCount) : '',
          albumCount: item.albumCount != null ? String(item.albumCount) : '',
        },
      })
    }

    const handleAlbumDetail = (item) => {
      void router.push({
        path: '/albumDetail',
        query: {
          source: item.source,
          id: item.id,
          name: item.name,
          img: item.img || '',
          author: item.author || '',
          desc: item.desc || '',
        },
      })
    }


    return {
      typeSources,
      source,
      handleSourceChange,
      searchTypes,
      searchType,
      handleTypeChange,
      handleSingerDetail,
      handleAlbumDetail,
      page,
      searchText,
    }
  },
}


</script>

<style lang="less" module>
.container {
  display: flex;
  flex-flow: column nowrap;
}

.header {
  flex: none;
  display: flex;
  flex-flow: column nowrap;
  gap: 4px;
  padding: 10px 8px;
  background-color: color-mix(in srgb, var(--color-button-background) 55%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 10px;
}

.typeRow {
  flex: none;
}

.channelRow {
  flex: none;
  display: flex;
  flex-flow: row nowrap;
}

.main {
  position: relative;
  flex: auto;
  // min-height: 0;
}
</style>
