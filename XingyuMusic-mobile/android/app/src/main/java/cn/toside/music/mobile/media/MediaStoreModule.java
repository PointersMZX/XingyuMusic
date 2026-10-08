package cn.toside.music.mobile.media;

import android.content.ContentUris;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * 将本地文件保存进系统媒体库（MediaStore.Audio.Media），
 * Android 10+ 走 RELATIVE_PATH（公共目录 Music/星雨音乐），无需运行时权限。
 */
public class MediaStoreModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext reactContext;

  MediaStoreModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "MediaStoreModule";
  }

  @ReactMethod
  public void saveToMediaStore(String filePath, String title, String artist, String mimeType, final Promise promise) {
    try {
      File file = new File(filePath);
      if (!file.exists()) {
        promise.reject("FileNotFound", "file not found: " + filePath);
        return;
      }

      final Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
      final ContentValues values = new ContentValues();
      values.put(MediaStore.Audio.Media.TITLE, title);
      if (artist != null && !artist.isEmpty()) {
        values.put(MediaStore.Audio.Media.ARTIST, artist);
      }
      values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        values.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/星雨音乐");
      }
      values.put(MediaStore.MediaColumns.IS_PENDING, 1);

      final Uri uri;
      try {
        uri = reactContext.getContentResolver().insert(collection, values);
      } catch (Exception ex) {
        // 降级：不设 RELATIVE_PATH（部分 ROM 不支持）
        Log.w("MediaStoreModule", "insert with RELATIVE_PATH failed, fallback: " + ex.getMessage());
        values.remove(MediaStore.MediaColumns.MIME_TYPE);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          values.remove(MediaStore.Audio.Media.RELATIVE_PATH);
        }
        uri = reactContext.getContentResolver().insert(collection, values);
      }
      if (uri == null) {
        promise.reject("InsertFailed", "insert MediaStore uri failed");
        return;
      }

      InputStream in = null;
      OutputStream out = null;
      try {
        in = new FileInputStream(file);
        out = reactContext.getContentResolver().openOutputStream(uri);
        if (out == null) {
          promise.reject("StreamFailed", "openOutputStream failed");
          return;
        }
        final byte[] buffer = new byte[8192];
        int len;
        long total = 0;
        while ((len = in.read(buffer)) != -1) {
          out.write(buffer, 0, len);
          total += len;
        }
        out.flush();

        final ContentValues done = new ContentValues();
        done.put(MediaStore.MediaColumns.IS_PENDING, 0);
        done.put(MediaStore.MediaColumns.SIZE, total);
        reactContext.getContentResolver().update(uri, done, null, null);

        final long id = ContentUris.parseId(uri);
        promise.resolve(String.valueOf(id));
      } catch (Exception ex) {
        Log.e("MediaStoreModule", "save failed", ex);
        promise.reject("SaveFailed", ex.getMessage());
      } finally {
        closeQuietly(in);
        closeQuietly(out);
      }
    } catch (Exception ex) {
      Log.e("MediaStoreModule", "saveToMediaStore error", ex);
      promise.reject("Error", ex.getMessage());
    }
  }

  private static void closeQuietly(java.io.Closeable closeable) {
    try {
      if (closeable != null) closeable.close();
    } catch (Exception ignore) {
    }
  }
}
