<template>
  <div :class="$style.container">
    <div v-show="!listInfo.noItemLabel" ref="dom_list_ref" :class="$style.listContent" class="scroll">
      <ul>
        <li v-for="item in listInfo.list" :key="item.source + item.id" :class="$style.item" @click="emit('to-detail', item)">
          <div :class="$style.image">
            <img v-if="item.img" :class="$style.img" loading="lazy" decoding="async" :src="item.img" @error="$event.target.remove()">
            <img v-else :class="$style.img" src="@renderer/assets/images/xingyu-logo.png" alt="" />
          </div>
          <div :class="$style.desc">
            <h4>{{ item.name }}</h4>
            <p v-if="item.author" :class="$style.author">{{ item.author }}</p>
            <div :class="$style.info">
              <span v-if="item.publishDate">{{ item.publishDate }}</span>
              <span v-if="item.playCount"><svg-icon name="headphones" />{{ item.playCount }}</span>
              <span v-if="visibleSource">{{ sourceLabel(item.source) }}</span>
            </div>
          </div>
          <span :class="$style.detailCue" v-text="$t('search__view_detail')" />
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

const emit = defineEmits(['toggle-page', 'to-detail'])

const togglePage = (page) => {
  emit('toggle-page', page)
}

const sourceLabel = (source) => sourceNames.value[source] || source

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
  margin-bottom: 20px;
  position: relative;
  cursor: pointer;
  transition: opacity @transition-normal;
  &:hover {
    opacity: .8;
    .detailCue {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
.detailCue {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 2px 10px;
  font-size: 11px;
  line-height: 1.5;
  border-radius: 10px;
  background-color: var(--color-primary);
  color: var(--color-primary-font);
  box-shadow: 0 2px 8px 0 color-mix(in srgb, var(--color-primary) 40%, transparent);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity @transition-fast, transform @transition-fast;
  pointer-events: none;
}
.image {
  flex: none;
  width: 40%;
  display: flex;
  background-position: center;
  background-size: cover;
  border-radius: 4px;
  overflow: hidden;
  opacity: .9;
  aspect-ratio: 1 / 1;

  box-shadow: 0 0 2px 0 rgba(0,0,0,.2);
}
.img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.desc {
  flex: auto;
  padding: 2px 15px 2px 7px;
  overflow: hidden;
  h4 {
    font-size: 14px;
    text-align: justify;
    line-height: 1.3;
    .mixin-ellipsis-2();
  }
}
.info {
  display: flex;
  flex-flow: row nowrap;
  gap: 15px;
  margin-top: 8px;
  font-size: 12px;
  .mixin-ellipsis-1();
  text-align: justify;
  line-height: 1.2;
  color: var(--color-font-label);
  svg {
    margin-right: 2px;
  }
}
.author {
  margin-top: 6px;
  font-size: 12px;
  .mixin-ellipsis-1();
  text-align: justify;
  line-height: 1.3;
  color: var(--color-font-label);
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
