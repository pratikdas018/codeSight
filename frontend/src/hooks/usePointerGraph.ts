import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerLinkModel } from "../memory/types";

export interface RenderedPointerEdge extends PointerLinkModel {
  path: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const usePointerGraph = (pointerLinks: PointerLinkModel[]) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const registryRef = useRef(new Map<string, HTMLElement>());
  const [layoutVersion, setLayoutVersion] = useState(0);

  const registerNode = (id: string) => (element: HTMLElement | null) => {
    if (element) {
      registryRef.current.set(id, element);
    } else {
      registryRef.current.delete(id);
    }

    setLayoutVersion((current) => current + 1);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      setLayoutVersion((current) => current + 1);
    });

    observer.observe(container);
    for (const element of registryRef.current.values()) {
      observer.observe(element);
    }

    const handleWindowChange = () => {
      setLayoutVersion((current) => current + 1);
    };

    window.addEventListener("resize", handleWindowChange);
    container.addEventListener("scroll", handleWindowChange, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleWindowChange);
      container.removeEventListener("scroll", handleWindowChange);
    };
  }, [layoutVersion, pointerLinks.length]);

  const edges = useMemo<RenderedPointerEdge[]>(() => {
    const container = containerRef.current;
    if (!container) {
      return [];
    }

    const containerRect = container.getBoundingClientRect();

    return pointerLinks
      .map((link) => {
        const sourceElement = registryRef.current.get(link.sourceAnchorId);
        const targetElement = registryRef.current.get(link.targetAnchorId);

        if (!sourceElement || !targetElement) {
          return null;
        }

        const sourceRect = sourceElement.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        const sourceX = sourceRect.right - containerRect.left;
        const sourceY = sourceRect.top - containerRect.top + sourceRect.height / 2;
        const targetX = targetRect.left - containerRect.left;
        const targetY = targetRect.top - containerRect.top + targetRect.height / 2;
        const delta = clamp(Math.abs(targetX - sourceX) * 0.45, 48, 160);
        const path = `M ${sourceX} ${sourceY} C ${sourceX + delta} ${sourceY}, ${targetX - delta} ${targetY}, ${targetX} ${targetY}`;

        return {
          ...link,
          path,
        };
      })
      .filter((edge): edge is RenderedPointerEdge => Boolean(edge));
  }, [layoutVersion, pointerLinks]);

  return {
    containerRef,
    registerNode,
    edges,
  };
};
