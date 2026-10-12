/**
 * Makes a phone photo small enough to upload quickly, in the browser.
 *
 * Phone cameras save photos of 4-12MB, over the 5MB upload limit and slow on
 * a weak farm signal. The plant check needs nowhere near that much detail, so
 * a photo whose longer side is over MAX_EDGE, or which is not already a small
 * JPEG, is redrawn at most MAX_EDGE pixels long and saved as a JPEG.
 *
 * Never throws: when the browser cannot decode the file (e.g. HEIC on
 * Chrome), the original comes back and the caller's own type and size checks
 * decide what happens to it.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.85;
/** A JPEG this small and no longer than MAX_EDGE is uploaded as it is. */
const KEEP_BELOW_BYTES = 1.5 * 1024 * 1024;

export async function shrinkPhoto(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the camera's rotation, so a portrait photo stays
    // upright once the original's EXIF data is gone.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_EDGE && file.type === "image/jpeg" && file.size <= KEEP_BELOW_BYTES) {
      return file;
    }

    const scale = Math.min(1, MAX_EDGE / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]*$/, "") || "plant-photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
