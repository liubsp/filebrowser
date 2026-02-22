import { share, pub } from "@/api";

export const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

export const isIOS = (): boolean => {
  if (typeof window === "undefined") return false; // SSR safety

  const nav = window.navigator;

  // 1. Direct check (iPhone/iPod and iPads in Mobile Mode)
  const isDirectIOS = /iPhone|iPod|iPad/i.test(nav.userAgent);

  // 2. The "Hidden" iPad Check (Apple Silicon & Intel iPads in Desktop Mode)
  // Real Macs (MacBooks/iMacs) report 0 or 1 maxTouchPoints.
  const isDesktopModeIPad =
    /Macintosh/i.test(nav.userAgent) && nav.maxTouchPoints > 1;

  return isDirectIOS || isDesktopModeIPad;
};

export const isMacOS = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints <= 1
  );
};

export const isWindows = (): boolean => {
  if (typeof window === "undefined") return false;
  return /Windows NT/i.test(navigator.userAgent);
};

export const isMediaFile = (item: { type?: string } | undefined): boolean => {
  if (!item) return false;
  return item.type === "video" || item.type === "audio";
};

export const isVlcAvailable = (
  item: { type?: string } | undefined
): boolean => {
  return (
    (isAndroid() || isIOS() || isMacOS() || isWindows()) && isMediaFile(item)
  );
};

export const isJustPlayerAvailable = (
  item: { type?: string } | undefined
): boolean => {
  if (!item) return false;
  return isAndroid() && item.type === "video";
};

const createSharedFileUrl = async (itemUrl: string): Promise<string> => {
  const shareRes: Share = await share.create(itemUrl, "", "1", "days");
  return pub.getDownloadURL({ hash: shareRes.hash, path: "" }, false);
};

export const openInVlc = async (item: {
  url: string;
  type: string;
}): Promise<void> => {
  const fileUrl = await createSharedFileUrl(item.url);

  let vlcUrl: string;

  if (isIOS()) {
    // iOS uses vlc-x-callback URL scheme
    vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(
      fileUrl
    )}`;
  } else if (isAndroid()) {
    // Android uses intent:// URL scheme with ACTION_VIEW
    const urlWithoutScheme = fileUrl.replace(/^https?:\/\//, "");
    const scheme = fileUrl.startsWith("https://") ? "https" : "http";
    const mimeType = item.type === "video" ? "video/*" : "audio/*";
    vlcUrl =
      `intent://${urlWithoutScheme}#Intent;` +
      `scheme=${scheme};` +
      `action=android.intent.action.VIEW;` +
      `type=${mimeType};` +
      `package=org.videolan.vlc;` +
      `end`;
  } else {
    // macOS and Windows use vlc: scheme
    vlcUrl = `vlc:${fileUrl}`;
  }

  window.location.href = vlcUrl;
};

export const openInJustPlayer = async (item: {
  url: string;
  type: string;
}): Promise<void> => {
  const fileUrl = await createSharedFileUrl(item.url);
  const urlWithoutScheme = fileUrl.replace(/^https?:\/\//, "");
  const scheme = fileUrl.startsWith("https://") ? "https" : "http";

  const justPlayerUrl =
    `intent://${urlWithoutScheme}#Intent;` +
    `scheme=${scheme};` +
    `action=android.intent.action.VIEW;` +
    `type=video/*;` +
    `package=com.brouken.player;` +
    `end`;

  window.location.href = justPlayerUrl;
};
