<template>
  <div :class="$style.container">
    <div v-show="!listInfo.noItemLabel" ref="dom_list_ref" :class="$style.listContent" class="scroll">
      <ul>
        <li v-for="item in listInfo.list" :key="item.source + item.id" :class="$style.item" @click="openMv(item)">
          <div :class="$style.image">
            <img v-if="item.img" :class="$style.img" loading="lazy" decoding="async" :src="item.img" @error="$event.target.remove()">
            <img v-else :class="$style.img" src="@renderer/assets/images/xingyu-logo.png" alt="" />
            <span v-if="item.duration" :class="$style.duration" v-text="item.duration" />
          </div>
          <div :class="$style.desc">
            <h4>{{ item.name }}</h4>
            <p v-if="item.singer" :class="$style.singer">{{ item.singer }}</p>
            <span v-if="visibleSource" :class="$style.source">{{ sourceLabel(item.source) }}</span>
          </div>
        </li>
        <li v-for="(i, index) in 6" :key="index" :class="$style.item" style="margin-bottom: 0;height: 0;" />
      </ul>
      <div :class="$style.pagination">
        <material-pagination :count="listInfo.total" :limit="listInfo.limit" :page="listInfo.page" @btn-click="togglePage" />
      </div>
    </div>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-show="listInfo.noItemLabel" :class="$style.noitem">
        <p v-text="listInfo.noItemLabel" />
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from '@common/utils/vueTools'
import { openUrl } from '@common/utils/electron'
import { sourceNames } from '@renderer/store'

defineProps({
  listInfo: {
    type: Object,
    required: true,
  },
  visibleSource: {
    type: Boolean,
    default: false,
  },
})

const dom_list_ref = ref(null)

const emit = defineEmits(['toggle-page'])

const togglePage = (page) => {
  emit('toggle-page', page)
}

const sourceLabel = (source) => sourceNames.value[source] || source

const openMv = (item) => {
  if (item.pageUrl) void openUrl(item.pageUrl)
}

defineExpose({
  scrollTo(top) {
    dom_list_ref.value?.scrollTo({
      top,
    })
  },
  getScrollTop() {
    return dom_list_ref.value?.scrollTop ?? 0
  },
})

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.container {
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  position: relative;
}

.listContent {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  font-size: 14px;
  box-sizing: border-box;
  padding: 15px 15px 0;

  ul {
    display: flex;
    flex-flow: row wrap;
    justify-content: space-between;
  }
}
.item {
  max-width: 360px;
  width: 32%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
  position: relative;
  cursor: pointer;
  transition: opacity @transition-normal;
  &:hover {
    opacity: .8;
  }
}
.image {
  flex: none;
  width: 100%;
  display: flex;
  background-position: center;
  background-size: cover;
  border-radius: 4px;
  overflow: hidden;
  opacity: .9;
  aspect-ratio: 16 / 9;

  box-shadow: 0 0 2px 0 rgba(0,0,0,.2);
}
.img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.duration {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 6px;
  font-size: 11px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, .55);
  color: #fff;
}
.desc {
  flex: auto;
  padding: 6px 2px 0;
  overflow: hidden;
  h4 {
    font-size: 14px;
    text-align: justify;
    line-height: 1.3;
    .mixin-ellipsis-2();
  }
}
.singer {
  margin-top: 4px;
  font-size: 12px;
  .mixin-ellipsis-1();
  color: var(--color-font-label);
}
.source {
  margin-top: 4px;
  display: inline-block;
  padding: 0 6px;
  font-size: 11px;
  border-radius: 8px;
  background-color: var(--color-primary);
  color: var(--color-primary-font);
}
.pagination {
  text-align: center;
  padding: 15px 0;
}
.noitem {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;

  p {
    font-size: 24px;
    color: var(--color-font-label);
  }
}

</style>
