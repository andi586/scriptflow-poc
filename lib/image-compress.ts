/** Browser-only: resize wide images when original file is large (keeps smaller files untouched). */

const TWO_MB = 2 * 1024 * 1024;
const MAX_WIDTH_PX = 800;
const JPEG_QUALITY = 0.88;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

async function resizeToMaxWidth(file: File, maxWidth: number): Promise<{ blob: Blob; contentType: string }> {
  const img = await loadImageElement(file);
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to compress image"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  return { blob, contentType: "image/jpeg" };
}

/**
 * If file is larger than 2MB, re-encode to JPEG with max width 800px.
 * Otherwise returns the original file.
 */
export async function prepareImageForUpload(file: File): Promise<{ blob: Blob; contentType: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }
  if (file.size <= TWO_MB) {
    return { blob: file, contentType: file.type || "image/jpeg" };
  }
  return resizeToMaxWidth(file, MAX_WIDTH_PX);
}
