import { share, pub } from "@/api";

const SHARE_REUSE_MIN_REMAINING_SECONDS = 12 * 60 * 60;
const EXTERNAL_PLAYER_SHARE_DURATION_DAYS = "7";

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

const isReusableShare = (link: Share): boolean => {
  const expire = Number(link.expire);

  if (expire === 0) {
    return true;
  }

  if (!Number.isFinite(expire) || expire <= 0) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return expire - nowSeconds > SHARE_REUSE_MIN_REMAINING_SECONDS;
};

const getReusableShare = async (itemUrl: string): Promise<Share | undefined> => {
  try {
    const res = (await share.get(itemUrl)) as Share[] | Share;
    const links = Array.isArray(res) ? res : [res];

    return links
      .filter((link) => !!link && !(link as any).password_hash)
      .filter((link) => isReusableShare(link))
      .sort((a, b) => {
        const expireA = Number(a.expire);
        const expireB = Number(b.expire);

        if (expireA === 0) return -1;
        if (expireB === 0) return 1;

        return expireB - expireA;
      })[0];
  } catch (_e) {
    return undefined;
  }
};

const createSharedFileUrl = async (itemUrl: string): Promise<string> => {
  const existingShare = await getReusableShare(itemUrl);

  if (existingShare) {
    return pub.getDownloadURL(
      { hash: existingShare.hash, path: "", token: existingShare.token },
      false
    );
  }

  const shareRes: Share = await share.create(
    itemUrl,
    "",
    EXTERNAL_PLAYER_SHARE_DURATION_DAYS,
    "days"
  );
  return pub.getDownloadURL(
    { hash: shareRes.hash, path: "", token: shareRes.token },
    false
  );
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
