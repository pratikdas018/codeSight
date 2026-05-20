import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerLinkModel } from "../memory/types";

export interface RenderedPointerEdge extends PointerLinkModel {
  path: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const usePointerGraph = (pointerLinks: PointerLinkModel[]) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const registryRef = useRef(new Map<string, HTMLElement>());
  const callbackRegistryRef = useRef(
    new Map<string, (element: HTMLElement | null) => void>(),
  );
  const observerRef = useRef<ResizeObserver | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);

  const bumpLayoutVersion = useCallback(() => {
    setLayoutVersion((current) => current + 1);
  }, []);

  const registerNode = useCallback(
    (id: string) => {
      const existingCallback = callbackRegistryRef.current.get(id);
      if (existingCallback) {
        return existingCallback;
      }

      const callback = (element: HTMLElement | null) => {
        const previousElement = registryRef.current.get(id);
        if (previousElement === element) {
          return;
        }

        if (previousElement) {
          observerRef.current?.unobserve(previousElement);
          registryRef.current.delete(id);
        }

        if (element) {
          registryRef.current.set(id, element);
          observerRef.current?.observe(element);
        } else {
          callbackRegistryRef.current.delete(id);
        }

        bumpLayoutVersion();
      };

      callbackRegistryRef.current.set(id, callback);
      return callback;
    },
    [bumpLayoutVersion],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      bumpLayoutVersion();
    });
    observerRef.current = observer;

    observer.observe(container);
    for (const element of registryRef.current.values()) {
      observer.observe(element);
    }

    const handleWindowChange = () => {
      bumpLayoutVersion();
    };

    window.addEventListener("resize", handleWindowChange);
    container.addEventListener("scroll", handleWindowChange, { passive: true });

    return () => {
      observerRef.current = null;
      observer.disconnect();
      window.removeEventListener("resize", handleWindowChange);
      container.removeEventListener("scroll", handleWindowChange);
    };
  }, [bumpLayoutVersion]);

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
