import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export type TickerItem = {
  id: string;
  text: string;
  url?: string | null;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  priority?: number | null;
};

type HomeSettingsResponse = {
  ok?: boolean;
  data?: {
    ticker?: TickerItem[];
    updatedAt?: string;
  };
};

function inWindow(now: number, start?: string | Date | null, end?: string | Date | null) {
  const s = start ? new Date(start).getTime() : Number.NEGATIVE_INFINITY;
  const e = end ? new Date(end).getTime() : Number.POSITIVE_INFINITY;
  return now >= s && now <= e;
}

function sortTicker(a: TickerItem, b: TickerItem) {
  const pa = Number(a.priority ?? 0);
  const pb = Number(b.priority ?? 0);
  if (pb !== pa) return pb - pa; // priority desc
  const sa = a.startAt ? new Date(a.startAt).getTime() : 0;
  const sb = b.startAt ? new Date(b.startAt).getTime() : 0;
  return sb - sa; // startAt desc
}

function LinkOrSpan({ item }: { item: TickerItem }) {
  const content = (
    <span className="text-white">
      {item.text}
    </span>
  );

  if (item.url) {
    return (
      <a
        className="hover:underline focus:underline focus:outline-none text-white"
        href={item.url}
        target="_self"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    );
  }
  return content;
}

export function NewsTicker({ className }: { className?: string }) {
  const [items, setItems] = useState<TickerItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState<number>(20);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        // First fetch to read updatedAt for cache busting
        const first = await api("/api/settings/home");
        const updatedAt = (first.json?.data?.updatedAt as string) || new Date().toISOString();
        const res = await api(`/api/settings/home?v=${encodeURIComponent(updatedAt || String(Date.now()))}`);
        const json = (res.json as HomeSettingsResponse) || {};
        const raw = (json.data?.ticker || []) as TickerItem[];
        const now = Date.now();
        const filtered = raw.filter((it) => inWindow(now, it.startAt ?? null, it.endAt ?? null)).sort(sortTicker);
        if (!ignore) {
          setItems(filtered);
        }
      } catch (e) {
        if (!ignore) {
          setError("Ticker unavailable");
          setItems([]);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // Measure and set animation duration based on content width
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const W = node.scrollWidth; // width of one sequence
    if (!W) return;
    const speed = 100; // px per second
    const d = Math.max(10, Math.round((W / speed)));
    setDuration(d);
  }, [items]);

  const displayItems = useMemo(() => {
    if (!items || items.length === 0) return [{ id: '__fallback__', text: 'Welcome! Add lines from Admin.' }];
    return items;
  }, [items]);

  const sequence = useMemo(() => {
    return (
      <div className="flex items-center gap-8 shrink-0 pr-8" ref={contentRef}>
        {displayItems.map((it) => (
          <span key={it.id || `${it.text}-${it.url || ""}`}
            className="text-sm text-foreground/90 whitespace-nowrap">
            <LinkOrSpan item={it} />
          </span>
        ))}
      </div>
    );
  }, [displayItems]);

  if (error) {
    return (
      <div className={cn("w-screen relative left-[calc(-50vw+50%)] bg-black border-t border-b border-white overflow-hidden py-3 px-4", className)}>
        <div className="h-6 flex items-center justify-center text-xs text-white">{error}</div>
      </div>
    );
  }

  if (items === null) {
    return (
      <div className={cn("w-screen relative left-[calc(-50vw+50%)] bg-black border-t border-b border-white overflow-hidden py-3 px-4", className)}>
        <div className="h-6 bg-white/20 animate-pulse rounded" />
      </div>
    );
  }

  // always render; we have a fallback item when empty

  return (
    <div
      className={cn(
        "w-screen relative left-[calc(-50vw+50%)] bg-black border-t border-b border-white overflow-hidden select-none py-3 px-4",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <style>{`
        @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
      <div
        className="flex"
        style={{
          animationName: "ticker-scroll",
          animationDuration: `${duration}s`,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {sequence}
        <div className="flex items-center gap-8 shrink-0 pr-8" aria-hidden="true">
          {items.map((it, idx) => (
            <span key={`dup-${idx}-${it.id || it.text}`}
              className="text-sm text-white whitespace-nowrap">
              <LinkOrSpan item={it} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NewsTicker;
