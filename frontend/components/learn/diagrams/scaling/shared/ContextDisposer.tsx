'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * Place inside every <Canvas> to explicitly release the WebGL context on unmount.
 * This prevents stale contexts from accumulating when IntersectionObserver
 * mounts/unmounts canvases as the user scrolls.
 */
export function ContextDisposer() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    return () => {
      gl.dispose()
    }
  }, [gl])

  return null
}
