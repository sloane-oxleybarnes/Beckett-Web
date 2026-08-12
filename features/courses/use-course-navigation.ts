import { useState } from 'react'
import type { CoursePhase } from './course-client-model'

export function useCourseNavigation(slideCount: number) {
  const [phase, setPhase] = useState<CoursePhase>('confidence-start')
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const totalSteps = slideCount + 7
  function stepFor(nextPhase = phase, slideIndex = currentSlideIndex): number {
    if (nextPhase === 'confidence-start') return 1
    if (nextPhase === 'slides') return 2 + slideIndex
    if (nextPhase === 'guided-practice') return 2 + slideCount
    if (nextPhase === 'open-practice-intro') return 3 + slideCount
    if (nextPhase === 'open-practice') return 4 + slideCount
    if (nextPhase === 'debrief') return 5 + slideCount
    if (nextPhase === 'confidence-end') return 6 + slideCount
    return totalSteps
  }
  const progressFor = (nextPhase = phase, slideIndex = currentSlideIndex) => Math.round((stepFor(nextPhase, slideIndex) / totalSteps) * 100)
  return { phase, setPhase, currentSlideIndex, setCurrentSlideIndex, progressFor }
}
