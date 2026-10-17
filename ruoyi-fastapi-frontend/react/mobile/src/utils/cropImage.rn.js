import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
export async function cropImage(src, crop) {
  const result = await manipulateAsync(
    src,
    [
      {
        crop: {
          originX: Math.round(crop.x),
          originY: Math.round(crop.y),
          width: Math.max(1, Math.floor(crop.width)),
          height: Math.max(1, Math.floor(crop.height)),
        },
      },
      { resize: { width: 400 } },
    ],
    { compress: 0.9, format: SaveFormat.JPEG },
  );
  return result.uri;
}
