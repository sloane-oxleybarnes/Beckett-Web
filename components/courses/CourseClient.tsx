'use client'

import CourseExperience from '@/features/courses/CourseExperience'
import type { Course } from '@/lib/courses'

export default function CourseClient({ initialCourse }: { initialCourse: Course }) {
  return <CourseExperience initialCourse={initialCourse} />
}
