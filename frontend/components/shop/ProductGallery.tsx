"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type ProductGalleryProps = {
  name: string;
  images: string[];
};

export function ProductGallery({ name, images }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const zoomRef = useRef<HTMLDivElement>(null);

  // Hover zoom follows the pointer. Written straight to the DOM, no re-renders.
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !zoomRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    zoomRef.current.style.transformOrigin = `${x}% ${y}%`;
  };

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      <ul className="no-scrollbar flex gap-3 overflow-x-auto lg:w-20 lg:flex-col">
        {images.map((src, i) => (
          <li key={src} className="shrink-0">
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-current={active === i}
              className={`relative block size-16 overflow-hidden rounded-[12px] bg-surface-2 transition lg:size-20 ${
                active === i ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : "opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          </li>
        ))}
      </ul>

      <div
        onPointerMove={onMove}
        className="group relative aspect-[4/5] flex-1 cursor-zoom-in overflow-hidden rounded-panel bg-surface-2"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <div
              ref={zoomRef}
              className="absolute inset-0 transition-transform duration-500 ease-out md:group-hover:scale-[1.8]"
            >
              <Image
                src={images[active]}
                alt={name}
                fill
                priority={active === 0}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
