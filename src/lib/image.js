import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { safeName, stripExtension } from './files';

/**
 * The one downscale pass every upload goes through.
 *
 * Three reasons it is not optional:
 *
 *  - `/api/image-generation/generate` and the AI-template generate endpoint cap
 *    an upload at 10MB. A modern phone camera clears that on a single frame.
 *  - Bulk edit sends up to 50 photos in ONE multipart request. At 4MB each that
 *    is 200MB over mobile data, and the request times out long before it lands.
 *  - The model re-encodes to at most 1536px on its longest edge anyway, so
 *    anything above ~2048 is detail nobody will ever see, paid for in upload
 *    seconds.
 *
 * The SDK 54+ ImageManipulator is a builder — `manipulate()` then
 * `renderAsync()` then `saveAsync()` — rather than the single `manipulateAsync`
 * call older snippets use.
 *
 * @param {{uri, name, mimeType, width?, height?}} asset
 * @param {{ maxEdge?: number, quality?: number }} [options]
 * @returns {Promise<{uri, name, mimeType, width, height}>}
 */
export async function optimizeForUpload(asset, { maxEdge = 2048, quality = 0.85 } = {}) {
  try {
    let { width, height } = asset;

    // A camera capture or a content:// pick can arrive with no dimensions.
    // Rendering once is the cheapest way to learn them.
    if (!width || !height) {
      const probe = await ImageManipulator.manipulate(asset.uri).renderAsync();
      width = probe.width;
      height = probe.height;
    }

    const longEdge = Math.max(width, height);
    let context = ImageManipulator.manipulate(asset.uri);
    if (longEdge > maxEdge) {
      // Constrain the LONG edge and let the manipulator derive the other, so
      // the aspect ratio survives — passing both would stretch a portrait.
      context = context.resize(width >= height ? { width: maxEdge } : { height: maxEdge });
    }

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: Math.max(0.1, Math.min(1, quality)),
    });

    return {
      uri: saved.uri,
      name: `${safeName(stripExtension(asset.name), 'photo')}.jpg`,
      mimeType: 'image/jpeg',
      width: saved.width ?? rendered.width,
      height: saved.height ?? rendered.height,
    };
  } catch {
    // A failed optimise is not a failed upload — the original is still a valid
    // image, and the server will tell us if it is genuinely too large.
    return asset;
  }
}

/** Runs `optimizeForUpload` over a list, reporting progress as it goes. */
export async function optimizeAll(assets, options = {}, onProgress) {
  const out = [];
  for (let i = 0; i < assets.length; i += 1) {
    out.push(await optimizeForUpload(assets[i], options));
    onProgress?.(i + 1, assets.length);
  }
  return out;
}
