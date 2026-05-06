"use client"

/**
 * Auto-scroll hook for drag and drop operations (Universal Version)
 *
 * Provides intelligent auto-scrolling when dragging near container edges.
 * Works with both mouse and touch events using requestAnimationFrame.
 * Includes smooth acceleration and deceleration for better UX.
 *
 * @version 2.0 - Universal mouse + touch support
 */

import { useEffect, RefObject, useRef } from 'react'

interface AutoScrollConfig {
  /** Distance from edge in pixels to trigger scroll */
  edgeThreshold?: number
  /** Base scroll speed in pixels per frame */
  scrollSpeed?: number
  /** Acceleration multiplier for proximity to edge */
  acceleration?: number
  /** Smoothing factor for scroll transitions */
  smoothing?: number
}

const DEFAULT_CONFIG: Required<AutoScrollConfig> = {
  edgeThreshold: 100,
  scrollSpeed: 12,
  acceleration: 1.5,
  smoothing: 0.8
}

/**
 * Auto-scroll hook for drag operations (Universal)
 *
 * @param containerRef - Reference to the scrollable container (null for window scroll)
 * @param isDragging - Whether a drag operation is active
 * @param config - Configuration options for scroll behavior
 */
export function useDragAutoScroll(
  containerRef: RefObject<HTMLElement | null> | null,
  isDragging: boolean,
  config: AutoScrollConfig = {}
) {
  const {
    edgeThreshold,
    scrollSpeed,
    acceleration,
    smoothing
  } = { ...DEFAULT_CONFIG, ...config }

  // Use refs to avoid recreating handlers on every render
  const currentPointerYRef = useRef<number>(0)
  const isScrollingRef = useRef<boolean>(false)
  const animationFrameIdRef = useRef<number | undefined>(undefined)
  const currentScrollVelocityRef = useRef<number>(0)
  const targetScrollVelocityRef = useRef<number>(0)

  useEffect(() => {
    if (!isDragging) {
      // Reset refs when not dragging
      isScrollingRef.current = false
      currentScrollVelocityRef.current = 0
      targetScrollVelocityRef.current = 0
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = undefined
      }
      return
    }

    // Use window/document if no container provided
    const container = containerRef?.current || null
    const useWindowScroll = !container

    /**
     * Update scroll velocity based on current pointer position
     * Called on every animation frame
     */
    const updateScrollVelocity = () => {
      let rect: DOMRect
      let currentScrollTop: number
      let maxScrollTop: number

      if (useWindowScroll) {
        // Use viewport for window scroll
        rect = {
          top: 0,
          bottom: window.innerHeight,
          left: 0,
          right: window.innerWidth,
          width: window.innerWidth,
          height: window.innerHeight,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }
        currentScrollTop = window.scrollY
        maxScrollTop = document.documentElement.scrollHeight - window.innerHeight
      } else {
        rect = container!.getBoundingClientRect()
        currentScrollTop = container!.scrollTop
        maxScrollTop = container!.scrollHeight - container!.clientHeight
      }

      const pointerY = currentPointerYRef.current

      // Calculate distances from edges
      const distanceFromTop = pointerY - rect.top
      const distanceFromBottom = rect.bottom - pointerY

      // Reset target velocity
      targetScrollVelocityRef.current = 0

      // Check scroll boundaries
      const isAtTop = currentScrollTop <= 0
      const isAtBottom = currentScrollTop >= maxScrollTop - 1 // -1 for rounding errors

      // Scroll up logic
      if (distanceFromTop < edgeThreshold && distanceFromTop > 0 && !isAtTop) {
        const intensity = Math.max(0.1, (edgeThreshold - distanceFromTop) / edgeThreshold)
        targetScrollVelocityRef.current = -(scrollSpeed * Math.pow(intensity, acceleration))
      }
      // Scroll down logic
      else if (distanceFromBottom < edgeThreshold && distanceFromBottom > 0 && !isAtBottom) {
        const intensity = Math.max(0.1, (edgeThreshold - distanceFromBottom) / edgeThreshold)
        targetScrollVelocityRef.current = scrollSpeed * Math.pow(intensity, acceleration)
      }
    }

    /**
     * Animation loop using requestAnimationFrame
     * Runs continuously while dragging
     */
    const animationLoop = () => {
      if (!isDragging) {
        isScrollingRef.current = false
        currentScrollVelocityRef.current = 0
        targetScrollVelocityRef.current = 0
        return
      }

      // Update velocity based on current pointer position
      updateScrollVelocity()

      // Smooth velocity interpolation (ease in/out)
      currentScrollVelocityRef.current +=
        (targetScrollVelocityRef.current - currentScrollVelocityRef.current) * smoothing

      // Apply scroll if velocity is significant
      if (Math.abs(currentScrollVelocityRef.current) > 0.1) {
        if (useWindowScroll) {
          window.scrollBy(0, currentScrollVelocityRef.current)
        } else {
          container!.scrollBy(0, currentScrollVelocityRef.current)
        }
      }

      // Continue animation loop
      animationFrameIdRef.current = requestAnimationFrame(animationLoop)
    }

    /**
     * Mouse move handler - updates pointer position
     */
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      currentPointerYRef.current = e.clientY
    }

    /**
     * Touch move handler - updates pointer position
     * Works with drag & drop libraries that support touch
     */
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length === 0) return
      const touch = e.touches[0]
      currentPointerYRef.current = touch.clientY
    }

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })

    // Start animation loop
    if (!isScrollingRef.current) {
      isScrollingRef.current = true
      animationLoop()
    }

    return () => {
      // Cleanup
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('touchmove', handleTouchMove)

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = undefined
      }

      isScrollingRef.current = false
      currentScrollVelocityRef.current = 0
      targetScrollVelocityRef.current = 0
    }
  }, [isDragging, containerRef, edgeThreshold, scrollSpeed, acceleration, smoothing])
}

/**
 * Utility function to check if an element needs scrolling
 */
export function hasScrollableContent(element: HTMLElement | null): boolean {
  if (!element) return false
  return element.scrollHeight > element.clientHeight
}

/**
 * Utility function to get scroll progress (0-1)
 */
export function getScrollProgress(element: HTMLElement | null): number {
  if (!element || !hasScrollableContent(element)) return 0

  const maxScroll = element.scrollHeight - element.clientHeight
  return maxScroll > 0 ? element.scrollTop / maxScroll : 0
}
