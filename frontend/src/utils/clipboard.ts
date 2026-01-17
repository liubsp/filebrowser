// Based on code by the following links:
// https://stackoverflow.com/a/74528564
// https://web.dev/articles/async-clipboard

interface ClipboardArgs {
  text?: string;
  data?: ClipboardItems;
}

interface ClipboardOpts {
  permission?: boolean;
}

export function copy(data: ClipboardArgs, opts?: ClipboardOpts) {
  return new Promise<void>((resolve, reject) => {
    if (
      // Clipboard API requires secure context
      window.isSecureContext &&
      typeof navigator.clipboard !== "undefined"
    ) {
      if (opts?.permission) {
        getPermission("clipboard-write")
          .then(() => writeToClipboard(data).then(resolve).catch(reject))
          .catch(reject);
      } else {
        writeToClipboard(data).then(resolve).catch(reject);
      }
    } else if (
      document.queryCommandSupported &&
      document.queryCommandSupported("copy") &&
      data.text // old method only supports text
    ) {
      const textarea = createTemporaryTextarea(data.text);
      const body = document.activeElement || document.body;
      try {
        body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        body.removeChild(textarea);
      }
    } else {
      reject(
        new Error("None of copying methods are supported by this browser!")
      );
    }
  });
}

function getPermission(name: string) {
  return new Promise<void>((resolve, reject) => {
    typeof navigator.permissions !== "undefined" &&
      navigator.permissions
        // @ts-expect-error chrome specific api
        .query({ name })
        .then((permission) => {
          if (permission.state === "granted" || permission.state === "prompt") {
            resolve();
          } else {
            reject(new Error("Permission denied!"));
          }
        });
  });
}

function writeToClipboard(data: ClipboardArgs) {
  if (data.text) {
    return navigator.clipboard.writeText(data.text);
  }
  if (data.data) {
    return navigator.clipboard.write(data.data);
  }

  return new Promise<void>((resolve, reject) => {
    reject(new Error("No data was supplied!"));
  });
}

const styles = {
  fontSize: "12pt",
  position: "fixed",
  top: 0,
  left: 0,
  width: "2em",
  height: "2em",
  padding: 0,
  margin: 0,
  border: "none",
  outline: "none",
  boxShadow: "none",
  background: "transparent",
};

function createTemporaryTextarea(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  Object.assign(textarea.style, styles);
  return textarea;
}

/**
 * Copy text to clipboard using a Promise for the text content.
 * This is required for iOS Safari compatibility when the text is obtained
 * asynchronously (e.g., from an API call) because iOS requires clipboard
 * operations to be initiated synchronously within the user gesture.
 *
 * By using ClipboardItem with a Promise-based blob, the clipboard is
 * "reserved" synchronously during the click, and the data is filled in
 * when the Promise resolves.
 */
export function copyAsync(textPromise: Promise<string>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (
      window.isSecureContext &&
      typeof navigator.clipboard !== "undefined" &&
      typeof ClipboardItem !== "undefined"
    ) {
      // Create ClipboardItem with promised data - must be called synchronously in gesture
      const blobPromise = textPromise.then(
        (text) => new Blob([text], { type: "text/plain" })
      );
      const clipboardItem = new ClipboardItem({
        "text/plain": blobPromise,
      });
      navigator.clipboard.write([clipboardItem]).then(resolve).catch(reject);
    } else {
      // Fallback: wait for text then use legacy method
      textPromise
        .then((text) => copy({ text }))
        .then(resolve)
        .catch(reject);
    }
  });
}
