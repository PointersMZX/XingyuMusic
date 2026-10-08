import { NativeModules } from 'react-native'

const { MediaStoreModule } = NativeModules

/**
 * 将本地文件保存进系统媒体库（MediaStore.Audio.Media）
 * @returns 媒体库 ID
 */
export const saveToMediaStore = async(filePath: string, title: string, artist: string, mimeType: string): Promise<string> => {
  if (!MediaStoreModule?.saveToMediaStore) return Promise.reject(new Error('MediaStoreModule not available'))
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    MediaStoreModule.saveToMediaStore(filePath, title, artist, mimeType, resolve, reject)
  })
}
