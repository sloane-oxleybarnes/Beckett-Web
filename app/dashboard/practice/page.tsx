import AdaptiveConversationSimulator from '@/app/labs/adaptive-conversation/AdaptiveConversationSimulator'

/**
 * Practice now uses the Adaptive Conversation Simulator as its primary
 * experience. The Labs route remains available as a stable direct entry point
 * for existing links and competition materials.
 */
export default function PracticePage() {
  return <AdaptiveConversationSimulator embedded />
}
