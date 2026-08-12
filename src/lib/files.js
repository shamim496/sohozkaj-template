import { Directory, File, Paths } from 'expo-file-system';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';

/**
 * Where images live and how they leave the app.
 *
 * The web app had four browser primitives this module replaces: `<input
 * type=file>`, `Blob`, `URL.createObjectURL` and an `<a download>` click. Every
 * screen here only ever deals with `{ uri, name, mimeType, width, height }`.
 *
 * Everything is written into a folder in the CACHE directory. Android clears
 * that under storage pressure, which is the right lifetime for output the user
 * has already been offered a gallery save and a share sheet for — the copy that
 * matters is the one in their photo library, not ours.
 */

// The cache folder is internal and never seen, so it keeps its name — renaming
// it would only orphan whatever is mid-flight in it.
const WORK_DIR_NAME = 'sohozkaj-template';

// This one IS seen: it is the album the phone's gallery shows saved results in,
// so it carries the app's name. Renaming it leaves anything saved under the old
// name where it is — the library groups by album, it does not move assets.
const ALBUM_NAME = 'Easy AI Photo Edit';

function workDir() {
  const dir = new Directory(Paths.cache, WORK_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Strips anything a filesystem or a Content-Disposition header would choke on. */
export function safeName(name, fallback = 'photo') {
  const cleaned = String(name || '')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

/** `photo.jpg` -> `photo` */
export function stripExtension(name) {
  const dot = String(name || '').lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : String(name || '');
}

/** Normalises a picker asset to the one shape the rest of the app knows. */
function toAsset(asset, index = 0) {
  return {
    uri: asset.uri,
    // The library picker can return an asset with no filename at all.
    name: safeName(asset.fileName || `photo-${index + 1}.jpg`),
    size: asset.fileSize ?? null,
    mimeType: asset.mimeType || 'image/jpeg',
    width: asset.width ?? null,
    height: asset.height ?? null,
  };
}

/**
 * Photo-library picker.
 *
 * `quality: 1` and `exif: false`: the AI backend re-encodes anyway, and
 * `optimizeForUpload` below does the one downscale pass that matters, so a
 * lossy pre-pass here would only throw away detail twice.
 *
 * @returns {Promise<Array<{uri, name, size, mimeType, width, height}>>}
 *          Empty when the user cancels — cancelling is not an error.
 */
export async function pickImages({ multiple = false, limit } = {}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    const error = new Error('Photo access is needed to pick an image.');
    error.code = 'PERMISSION_DENIED';
    throw error;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    ...(limit ? { selectionLimit: limit } : {}),
    quality: 1,
    exif: false,
  });
  if (result.canceled) return [];
  return (result.assets || []).map(toAsset);
}

/** Camera capture, same asset shape as `pickImages`. */
export async function captureImage() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    const error = new Error('Camera access is needed to take a photo.');
    error.code = 'PERMISSION_DENIED';
    throw error;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
  });
  if (result.canceled) return null;
  const asset = (result.assets || [])[0];
  return asset ? toAsset(asset) : null;
}

/**
 * Pulls a generated image off R2 into the cache directory.
 *
 * The result URLs the API returns are public (the backend sets
 * `Cross-Origin-Resource-Policy: cross-origin` and the web app renders them
 * straight into an `<img>`), so this needs no auth header and skips the
 * backend's download proxy entirely — one hop instead of two, and no blob
 * handling, which React Native's XHR does badly.
 *
 * @param {string} url
 * @param {string} name filename WITHOUT extension
 * @returns {Promise<{uri, name, mimeType}>}
 */
export async function downloadImage(url, name) {
  const target = new File(workDir(), `${safeName(stripExtension(name))}.jpg`);
  const downloaded = await File.downloadFileAsync(url, target, { idempotent: true });
  return { uri: downloaded.uri, name: downloaded.name, mimeType: 'image/jpeg' };
}

/** Ask for photo-library access. Call once per run, before saving anything. */
export async function ensureGalleryPermission() {
  const permission = await requestPermissionsAsync();
  return permission.granted;
}

/**
 * Save one image to the device photo library.
 *
 * Filed into an album so a shop generating fifty photos a day can find them
 * again. Album creation needs broader permission than a bare save on some
 * Android versions, so a failure there falls back to saving loose rather than
 * losing the image.
 */
export async function saveToGallery(uri) {
  // Permission is asked for ONCE per run by the caller. Requesting it here per
  // file would fire fifty overlapping prompts on a fifty-image batch.
  try {
    const album = await Album.get(ALBUM_NAME);
    if (album) {
      await Asset.create(uri, album);
    } else {
      await Album.create(ALBUM_NAME, [uri], false);
    }
  } catch {
    // Album handling needs broader permission than a bare save does on some
    // Android versions. Saving loose beats losing the image.
    await Asset.create(uri);
  }
  return 'saved';
}

/** Download a remote image and put it straight into the gallery. */
export async function saveRemoteToGallery(url, name) {
  const file = await downloadImage(url, name);
  await saveToGallery(file.uri);
  return file;
}

/**
 * Hand a file to the user — the native answer to `<a download>`.
 *
 * Android has no user-visible Downloads write an app can make without either
 * the Storage Access Framework (a second folder-picker prompt) or a permission
 * users increasingly deny. The share sheet already lists Files, Drive, WhatsApp
 * and everything else they would want, in one tap.
 *
 * @returns {Promise<boolean>} false when sharing is unavailable on the device.
 */
export async function shareFile(uri, { dialogTitle } = {}) {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType: 'image/jpeg',
    UTI: 'public.jpeg',
    dialogTitle: dialogTitle || 'Share image',
  });
  return true;
}

/**
 * Converts an asset into the only value React Native's FormData accepts for a
 * file part.
 *
 * `FormData.getParts()` looks for an object carrying `uri`, and reads `name`
 * and `type` off it for the Content-Disposition and Content-Type headers; a web
 * `Blob` has none of those and is serialised as the string "[object Blob]".
 * The three-argument `append(field, blob, filename)` the web services use is
 * also silently ignored — RN's `append` takes two arguments.
 *
 * It must be a plain object, not a class instance: `getParts` spreads the
 * value, and a spread drops prototype getters — so an expo-file-system `File`
 * would lose its `uri` on the way through.
 */
export function toUploadFile(asset, fallbackName = 'photo.jpg') {
  return {
    uri: asset.uri,
    name: safeName(asset.name || fallbackName),
    type: asset.mimeType || 'image/jpeg',
  };
}

/** Deletes everything this module has written. */
export function clearWorkDir() {
  const dir = new Directory(Paths.cache, WORK_DIR_NAME);
  if (dir.exists) dir.delete();
}
