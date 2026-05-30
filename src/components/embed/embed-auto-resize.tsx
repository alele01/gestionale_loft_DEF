"use client";

import * as React from "react";

/**
 * When the request form runs inside an <iframe> on a host site, this
 * component continuously reports the document height to the parent window
 * via postMessage. The snippet we hand to the venue (see the event detail
 * page) listens for `cooker-loft-embed:height` and resizes the iframe, so
 * the embed never shows an inner scrollbar and "grows" naturally with the
 * host page.
 *
 * No-op when the page is opened directly (not inside an iframe).
 */
export function EmbedAutoResize() {
  React.useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;

    const post = () => {
      const height = Math.ceil(
        Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight ?? 0
        )
      );
      window.parent.postMessage(
        { type: "cooker-loft-embed:height", height },
        "*"
      );
    };

    post();

    const observer = new ResizeObserver(() => post());
    observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);

    window.addEventListener("load", post);
    // Late layout shifts (web fonts, images) settle within ~1s.
    const timers = [150, 500, 1000, 2000].map((ms) => setTimeout(post, ms));

    return () => {
      observer.disconnect();
      window.removeEventListener("load", post);
      timers.forEach(clearTimeout);
    };
  }, []);

  return null;
}
