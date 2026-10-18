'use client';

/**
 * Client-side image preparation.
 *
 * A phone photo is routinely 3–5 MB. Two problems follow from uploading it raw:
 * the request may exceed the server-action body limit, and the bucket fills with
 * images far larger than anything this app displays.
 *
 * So the browser downsizes before the bytes ever leave the device. This is not a
 * security control — the server validates type and size independently, and the
 * bucket enforces its own limit — it is a courtesy that makes the upload work on
 * a mobile connection.
 *
 * Failure is not fatal. If the canvas is unavailable (an old browser, a
 * cross-origin quirk), the original file is returned and the server-side limit
 * still applies.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export async function shrinkImage(file: File): Promise<File> {
  // GIF and SVG are neither accepted by the bucket nor safe to re-encode here.
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    // Already small enough: re-encoding would lose quality for no gain.
    if (scale === 1 && file.size <= 1_200_000) {
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) { bitmap.close(); return file; }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    // A new File keeps the browser's metadata stripped and gives the server a
    // predictable type to match against its allow-list.
    return new File([blob], 'photo.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
