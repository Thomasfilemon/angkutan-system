export function getApiHost() {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL!;
  // Remove trailing '/api' if present
  return url.endsWith("/api") ? url.replace(/\/api$/, "") : url;
}

export function buildImageUrl(imagePath: string) {
  if (!imagePath) return "";
  // If already absolute, return as is
  if (imagePath.startsWith("http")) return imagePath;
  // Otherwise, join with API host
  let base = getApiHost();
  if (!base.endsWith("/")) base += "/";
  if (imagePath.startsWith("/")) imagePath = imagePath.slice(1);
  return base + imagePath;
}
