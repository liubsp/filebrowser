import { share, pub } from "@/api";
import type { Resource, Share } from "@/types";

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

export const isMediaFile = (item: { type?: string } | undefined): boolean => {
  if (!item) return false;
  return item.type === "video" || item.type === "audio";
};

export const isVlcAvailable = (
  item: { type?: string } | undefined
): boolean => {
  return (isAndroid() || isIOS()) && isMediaFile(item);
};

export const openInVlc = async (item: {
  url: string;
  type: string;
}): Promise<void> => {
  const shareRes = (await share.create(item.url, "", "7", "days")) as Share;
  const fileUrl = await pub.getDownloadURL(
    { hash: shareRes.hash, path: "" } as Resource,
    false
  );

  let vlcUrl: string;

  if (isIOS()) {
    // iOS uses vlc-x-callback URL scheme
    vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(
      fileUrl
    )}`;
  } else {
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
  }

  window.location.href = vlcUrl;
};
