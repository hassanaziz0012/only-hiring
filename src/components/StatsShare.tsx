"use client";

import { useState, useSyncExternalStore } from "react";

async function fetchPng(src: string): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`image request failed: ${res.status}`);
  return res.blob();
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The server draws the image as a PNG; a JPEG is redrawn from it in the browser. */
async function toJpeg(png: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(png);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("JPEG encoding failed"))), "image/jpeg", 0.92),
  );
}

// Clipboard images need ClipboardItem, which only exists in the browser, so the button appears after hydration.
const noSubscribe = () => () => {};
const clipboardSupported = () => typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;
const notOnServer = () => false;

/**
 * Downloads (or copies) every figure on the stats page as one image, for posting on Reddit and elsewhere.
 * The PNG is a plain link, so it works before the page hydrates.
 */
export function StatsShare({ src, fileName }: { src: string; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canCopy = useSyncExternalStore(noSubscribe, clipboardSupported, notOnServer);

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(done);
    } catch {
      setMessage("That didn't work. Try the PNG link instead.");
    } finally {
      setBusy(false);
    }
  }

  const downloadJpeg = () => run(async () => save(await toJpeg(await fetchPng(src)), `${fileName}.jpg`), "JPEG downloaded.");
  // Safari only allows the write if the ClipboardItem is created in the click itself, so it gets the promise.
  const copy = () =>
    run(() => navigator.clipboard.write([new ClipboardItem({ "image/png": fetchPng(src) })]), "Image copied. Paste it into your post.");

  return (
    <section aria-labelledby="share" className="mt-10 bg-mint p-6 text-mint-ink md:p-8">
      <h2 id="share" className="text-lead font-bold tracking-tight">
        Share these numbers
      </h2>
      <p className="mt-1 max-w-[56ch]">
        Everything on this page as one image, with the site&apos;s address in the corner. Post it to Reddit, Discord or
        anywhere else.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href={src} download={`${fileName}.png`} className="btn">
          Download PNG
        </a>
        <button type="button" className="btn" onClick={downloadJpeg} disabled={busy}>
          Download JPEG
        </button>
        {canCopy && (
          <button type="button" className="btn btn-quiet" onClick={copy} disabled={busy}>
            Copy image
          </button>
        )}
      </div>
      <p role="status" className="mt-3 min-h-[1.5em] text-small">
        {busy ? "Working…" : message}
      </p>
      <details className="mt-2">
        <summary className="link tap inline-block font-bold">Preview the image</summary>
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated image at its own size, not a photo to optimise */}
        <img src={src} alt="The figures on this page, drawn as one image" loading="lazy" className="mt-4 h-auto w-full max-w-[40rem]" />
      </details>
    </section>
  );
}
