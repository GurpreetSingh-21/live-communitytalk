// CommunityTalkMobile/src/utils/imagekitUpload.ts
import { api } from "../api/api";

export interface ImageKitUploadOptions {
  fileName?: string;
  folder?: string;
}

/**
 * Directly uploads an image from device storage to ImageKit CDN using presigned credentials.
 * Bypasses sending large Base64 strings through the Express backend.
 *
 * @param fileUri Local device URI of the image (e.g. file:///...)
 * @param options Desired file name and target ImageKit folder
 * @returns The CDN URL of the uploaded image
 */
export async function uploadDirectToImageKit(
  fileUri: string,
  options: ImageKitUploadOptions = {}
): Promise<string> {
  const fileName = options.fileName || `photo_${Date.now()}.jpg`;
  const folder = options.folder || "avatars";

  // 1. Fetch presigned authentication parameters from backend
  const { data: auth } = await api.get("/api/upload/imagekit-auth");
  const { token, expire, signature, publicKey } = auth;

  if (!token || !signature || !publicKey) {
    throw new Error("Invalid ImageKit authentication credentials returned from backend");
  }

  // 2. Construct React Native FormData payload
  const formData = new FormData();
  const extension = fileName.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType =
    extension === "png"
      ? "image/png"
      : extension === "gif"
      ? "image/gif"
      : extension === "webp"
      ? "image/webp"
      : "image/jpeg";

  formData.append("file", {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as any);

  formData.append("fileName", fileName);
  formData.append("publicKey", publicKey);
  formData.append("signature", signature);
  formData.append("expire", String(expire));
  formData.append("folder", folder);
  formData.append("token", token);

  // 3. POST directly to ImageKit upload CDN
  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();

  if (!response.ok || !result.url) {
    console.error("[ImageKit Direct Upload Error]", result);
    throw new Error(result.message || "Failed to upload image directly to CDN");
  }

  if (__DEV__) {
    console.log("🚀 [ImageKit Direct Upload Success] URL:", result.url);
  }

  return result.url;
}
