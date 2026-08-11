"use client";

const MAX_DIMENSION = 1200;

export async function compressImage(
  file: File,
  maxBytes = 950_000
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    MAX_DIMENSION / bitmap.width,
    MAX_DIMENSION / bitmap.height
  );
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // Iteratively reduce quality until under maxBytes
  let quality = 0.88;
  while (quality > 0.1) {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        quality
      )
    );
    if (blob.size <= maxBytes) return blob;
    quality -= 0.08;
  }

  // Last attempt at minimum quality
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.1
    )
  );
}
