import { apiSource, qualityList, userApi } from '@renderer/store'
import { appSetting, setApiSource, updateSetting } from '@renderer/store/setting'
import { setUserApi as setUserApiAction } from '@renderer/utils/ipc'
import musicSdk from '@renderer/utils/musicSdk'
import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import { validateQingLines, buildQingCloudApis } from '@renderer/utils/musicSdk/qingCloud'

export const QINGCLOUD_API_ID = 'user_api_qingcloud'

/**
 * 官方渠道云（钥匙模型）：导入 `{lines:[...]}` 配置后，构造内置 6 渠道解析 api，
 * 挂载进 `userApi.apis` 并把 `apiSource` 指向 qingcloud 伪源，解锁对应渠道。
 * 未导入配置时保持"无解析"（各内置源 getMusicUrl 抛"未找到可用音源"）。
 */
export const applyQingCloud = () => {
  const config = appSetting['source.qingtngConfig']
  if (!config) {
    userApi.apis = {}
    userApi.status = false
    userApi.message = 'qingtng off'
    qualityList.value = {}
    return
  }
  const valid = validateQingLines(config)
  if (!valid.ok) {
    userApi.apis = {}
    qualityList.value = {}
    userApi.status = false
    userApi.message = valid.error ?? ''
    return
  }
  userApi.apis = buildQingCloudApis(valid.lines) as unknown as Partial<LX.UserApi.UserApiSources>
  qualityList.value = valid.qualityList
  userApi.status = true
  userApi.message = ''
  apiSource.value = QINGCLOUD_API_ID
  if (!window.lx.apiInitPromise[1]) window.lx.apiInitPromise[2](true)
}

/** 设置页"导入官方渠道 JSON"入口：持久化钥匙并立即启用。 */
export const saveQingCloudConfig = (json: string) => {
  updateSetting({ 'source.qingtngConfig': json, 'source.qingtngEnabled': true })
  applyQingCloud()
}

/** 关闭官方渠道云（钥匙移除后恢复"无解析"）。 */
export const disableQingCloud = () => {
  updateSetting({ 'source.qingtngConfig': '', 'source.qingtngEnabled': false })
  userApi.apis = {}
  qualityList.value = {}
  userApi.status = false
  apiSource.value = appSetting['common.apiSource']
  if (!window.lx.apiInitPromise[1]) window.lx.apiInitPromise[2](true)
}

let prevId = ''
export const setUserApi = async(apiId: string) => {
  if (prevId == apiId) return
  prevId = apiId
  if (window.lx.apiInitPromise[1]) {
    window.lx.apiInitPromise[0] = new Promise<boolean>(resolve => {
      window.lx.apiInitPromise[1] = false
      window.lx.apiInitPromise[2] = (result: boolean) => {
        window.lx.apiInitPromise[1] = true
        resolve(result)
      }
    })
  }

  if (/^user_api/.test(apiId)) {
    qualityList.value = {}
    userApi.status = false
    userApi.message = 'initing'

    await setUserApiAction(apiId).then(() => {
      if (prevId != apiId) return
      apiSource.value = apiId
    }).catch(err => {
      if (prevId != apiId) return
      if (!window.lx.apiInitPromise[1]) window.lx.apiInitPromise[2](false)
      console.log(err)
      let api = apiSourceInfo.find(api => !api.disabled)
      if (!api) return
      apiSource.value = api.id
      if (api.id != appSetting['common.apiSource']) setApiSource(api.id)
    })
  } else {
    // @ts-expect-error
    qualityList.value = musicSdk.supportQuality[apiId] ?? {}
    apiSource.value = apiId
    void setUserApiAction(apiId)
    if (!window.lx.apiInitPromise[1]) window.lx.apiInitPromise[2](true)
  }

  if (prevId != apiId) return
  if (apiId != appSetting['common.apiSource']) setApiSource(apiId)
}
