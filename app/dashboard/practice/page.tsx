import dynamic from 'next/dynamic'

const AdaptiveConversationSimulator = dynamic(
  () => import('@/app/labs/adaptive-conversation/AdaptiveConversationSimulator'),
  { loading: () => <PracticeLoadingState /> },
)

function PracticeLoadingState() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse px-4 py-10" aria-label="Loading practice simulator">
      <div className="h-8 w-56 rounded bg-slate-200" />
      <div className="mt-6 h-64 rounded-2xl bg-slate-100" />
    </div>
  )
}

/**
 * Practice now uses the Adaptive Conversation Simulator as its primary
 * experience. The Labs route remains available as a stable direct entry point
 * for existing links and competition materials.
 */
export default function PracticePage() {
  return <AdaptiveConversationSimulator embedded />
}
