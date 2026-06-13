import { useEffect, useState } from "react";
import { fetchImageBytes } from "../lib/fetch";
import { getCoverBytes } from "../lib/store";

/**
 * Cover thumbnail. When `ym` + `cacheKey` are given, loads cache-first from
 * the season's covers/ dir (downloading + caching on miss). We never use a
 * plain <img src=remote>: covers are http (mixed content) and would be blocked.
 */
export function Cover({ url, alt, ym, cacheKey }: { url: string; alt?: string; ym?: string; cacheKey?: string }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let obj: string | null = null;
    setSrc("");
    setFailed(false);
    if (!url) {
      setFailed(true);
      return;
    }
    const load = ym && cacheKey ? getCoverBytes(ym, cacheKey, url) : fetchImageBytes(url);
    load
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
  }, [url, ym, cacheKey]);

  if (failed) return <div className="cover cover--state">✗</div>;
  if (!src) return <div className="cover cover--state cover--loading" />;
  return <img className="cover" src={src} alt={alt ?? ""} loading="lazy" />;
}
