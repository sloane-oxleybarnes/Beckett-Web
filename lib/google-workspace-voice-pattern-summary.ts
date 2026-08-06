type VoicePatternThread = {
  messages: Array<{ fromEmail: string; body: string }>;
};

export function summarizeSelectedGmailVoicePattern(
  thread: VoicePatternThread,
  userEmail: string,
) {
  const currentUser = userEmail.trim().toLowerCase();
  const samples = thread.messages
    .filter((message) => message.fromEmail === currentUser && message.body.trim())
    .map((message) => message.body.trim());
  if (!samples.length) return null;

  const wordCounts = samples.map((sample) => sample.split(/\s+/).filter(Boolean).length);
  const averageWords = Math.round(wordCounts.reduce((total, count) => total + count, 0) / wordCounts.length);
  const averageParagraphs = Math.max(
    1,
    Math.round(samples.reduce((total, sample) => total + sample.split(/\n\s*\n/).length, 0) / samples.length),
  );
  const greetingRate = samples.filter((sample) => /^(hi|hello|hey|good morning|good afternoon)\b/i.test(sample)).length / samples.length;
  const signoffRate = samples.filter((sample) => /\n(?:best|thanks|thank you|cheers|regards)[,!]?(?:\n[^\n]+)?\s*$/i.test(sample)).length / samples.length;
  const bulletRate = samples.filter((sample) => /(^|\n)\s*[-*•]\s+/m.test(sample)).length / samples.length;

  const lengthLabel = averageWords <= 35 ? "concise" : averageWords <= 100 ? "moderately detailed" : "detailed";
  const traits = [
    `${lengthLabel} messages averaging about ${averageWords} words and ${averageParagraphs} paragraph${averageParagraphs === 1 ? "" : "s"}`,
    greetingRate >= 0.5 ? "usually opens with a greeting" : null,
    signoffRate >= 0.5 ? "usually closes with a sign-off" : null,
    bulletRate >= 0.4 ? "often organizes information with bullets" : null,
  ].filter(Boolean);

  return {
    sampleCount: samples.length,
    evidenceSummary: traits.join("; "),
    coachingNote: `When drafting email, default to ${lengthLabel} wording${greetingRate >= 0.5 ? " with a greeting" : ""}${bulletRate >= 0.4 ? " and bullets when listing details" : ""}.`,
    confidence: Math.min(0.9, 0.35 + samples.length * 0.1),
  };
}
