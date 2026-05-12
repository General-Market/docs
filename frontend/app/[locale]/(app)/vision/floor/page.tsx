import type { Metadata } from 'next'
import { Floor } from '@/components/domain/vision/floor/Floor'

export const metadata: Metadata = {
  title: 'The Floor — Vision',
  description: 'Live settlement floor for Vision markets.',
}

export default function VisionFloorPage() {
  return <Floor />
}
