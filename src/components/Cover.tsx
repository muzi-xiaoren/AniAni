import { useEffect, useRef, useState } from "react";
import { getCoverBytes } from "../lib/store";

/**
 * Cover thumbnail, loaded cache-first from the season's covers/ dir
 * (downloading + caching on miss). We never use a
 * plain <img src=remote>: covers are http (mixed content) and would be blocked.
 *
 * Loading waits until the card scrolls into view, so opening an uncached
 * season doesn't fire one request per show (70+) at once.
 */
export function Cover({ url, alt, ym, cacheKey }: { url: string; alt?: string; ym: string; cacheKey: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (visible || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    let obj: string | null = null;
    setSrc("");
    setFailed(false);
    if (!url) {
      setFailed(true);
      return;
    }
    getCoverBytes(ym, cacheKey, url)
      .then((bytes) => {
        if (!alive) return;
        obj = URL.createObjectURL(new Blob([bytes as BlobPart]));
        setSrc(obj);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [visible, url, ym, cacheKey]);

  if (failed) return <div className="cover cover--state">✗</div>;
  if (!src) return <div ref={holder} className="cover cover--state cover--loading" />;
  return <img className="cover" src={src} alt={alt ?? ""} />;
}
