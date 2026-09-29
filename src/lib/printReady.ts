/**
 * Wait for every <img> currently on the page to finish decoding, then print.
 *
 * A flat setTimeout before window.print() is a guess, not a guarantee — on a
 * slow connection or a large PNG (the logo is ~150KB), the browser can still
 * be mid-decode when the timer fires, and some browsers print whatever
 * partial raster state the image is in at that instant rather than waiting.
 * That showed up as the shop logo printing as a stray sliver of colour.
 */
export async function printWhenImagesReady() {
  const images = Array.from(document.images);
  await Promise.all(
    images.map((img) =>
      // decode() is supported by every browser this app targets; a rejection
      // (e.g. the image was removed, or a very old browser lacks it) is not
      // worth blocking print over — fall back to the load/error events, and
      // ultimately just proceed rather than hang forever.
      img.decode().catch(
        () =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve();
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
      ),
    ),
  );
  window.print();
}
