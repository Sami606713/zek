/** next/image only optimises the hosts listed in next.config; other URLs are shown as they are. */
export const unoptimized = (src: string) =>
  src.startsWith("blob:") || !/^https:\/\/((fastly\.)?picsum\.photos|res\.cloudinary\.com)\//.test(src);
