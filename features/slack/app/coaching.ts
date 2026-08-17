import { callAnthropic } from '@/lib/anthropic'
import { AiUsageLimitError } from '@/lib/ai-usage'
import { trackBetaEvent } from '@/lib/beta-events'
import { beckettBoundaryPrompt } from '@/lib/beckett-boundaries'
import { buildCoachingProfileBehavior, coachingToneContract, formatCoachingProfileForPrompt } from '@/lib/coaching-profile'
import { selectSlackAgentTool, slackAgentToolInstruction } from '@/lib/slack-agent-tools'
import { formatSlackPrepAssessment } from '@/lib/slack-prep-copy'
import { registerSlackCreditForResponse } from '@/lib/slack-credits'
import { SLACK_PRACTICE_INTENT_RULE } from '@/lib/slack-practice-copy'
import { formatSlackInitialResponse, limitSlackDecodeWords, normalizeSlackPracticeCopy } from '@/lib/slack-response-format'
import { metering } from '@/lib/metering'
import { isRelationshipHistoryPrompt, slackNoContextPromptInstruction, SLACK_RELATIONSHIP_LIMITATION_NOTE } from './context'
import {
  MAX_LONGER_SLACK_ANSWER_LENGTH, MAX_QUICK_SLACK_ANSWER_LENGTH,
  fitSlackAnswer, noteSlackContextValidation, slackCreditRequestId, slackIntentInstruction, truncateSlackText,
  type SlackCoachingIntent, type SlackConnectedUser, type SlackContextFailureReason, type SlackContextStatus, type SlackResponseDetail,
} from './message'

export async function runSlackCoaching({
  user,
  action,
  prompt,
  sourceLabel,
  messageText,
  contextStatus,
  contextFailureReason,
  contextMessageCount,
  broaderSearchUsed,
  relationshipContext,
  responseDetail,
  intent = "general",
  initialTemplate = action !== "agent_message",
}: {
  user: SlackConnectedUser;
  action: "slash_command" | "message_shortcut" | "agent_message";
  prompt: string;
  sourceLabel: string;
  messageText?: string | null;
  contextStatus?: SlackContextStatus;
  contextFailureReason?: SlackContextFailureReason | null;
  contextMessageCount?: number;
  broaderSearchUsed?: boolean;
  relationshipContext?: string | null;
  responseDetail?: SlackResponseDetail;
  intent?: SlackCoachingIntent;
  initialTemplate?: boolean;
}) {
  void sourceLabel;
  if (contextStatus) {
    await noteSlackContextValidation(
      user.id,
      contextStatus === "available" ? null : contextFailureReason || "slack_api_error"
    ).catch((error) => {
      console.error("Slack context validation metadata update failed", error);
    });
  }

  const credit = await metering.slack.reserve({
    requestId: slackCreditRequestId([user.slackTeamId, user.slackUserId, action, prompt, messageText]),
    teamId: user.slackTeamId,
    slackUserId: user.slackUserId,
    beckettUserId: user.id,
  });
  if (!credit) throw new Error("Slack credit reservation was not created");

  const agentTool = selectSlackAgentTool({
    intent,
    action,
    hasSlackContext: Boolean(messageText || relationshipContext || contextStatus === "available"),
  });
  const isRelationshipRequest = isRelationshipHistoryPrompt(prompt);
  const shouldShowRelationshipLimitation =
    isRelationshipRequest && contextStatus === "available" && !broaderSearchUsed;

  const profileInput = {
    display_name: user.name,
    communication_preferences: user.communicationPreferences,
    coaching_tone: user.coachingTone,
    strengths: user.strengths,
    workplace_triggers: user.workplaceTriggers,
    neurodivergent_context: user.neurodivergentContext,
    neurodivergent_context_other: user.neurodivergentContextOther,
  };
  const profileBehavior = buildCoachingProfileBehavior(profileInput);
  const toneContract = coachingToneContract(user.coachingTone);
  const presentationConstraint =
    profileBehavior.instrumentation.responseLengthClass === "detailed"
      ? "For an initial Decode, detailed coaching must use the available space to explain evidence, uncertainty, social logic, and why the next move works. Target 170-210 words and keep it scannable with compact bullets. Suggested user messages must still follow any saved concision preference."
      : profileBehavior.instrumentation.responseLengthClass === "short"
        ? "For an initial Decode, target 25-45 words and never exceed 60. Keep only the most defensible read and immediate action; add suggested wording only when requested or clearly useful."
        : "For compact Slack flows, normally use no more than 140 words and 9 nonblank lines. Keep the response scannable without flattening the selected coaching style.";

  const system = `You are Beckett, a workplace and workplace-adjacent communication coach for neurodivergent professionals.
	You are responding inside Slack, so be concise, practical, and easy to scan.
	The Slack-authenticated requester is ${user.name || "a connected Beckett user"}. If asked who the requester is, use this identity and never claim that you cannot access it.
	Slack has already authenticated the requester separately from people they tag. Treat a tagged third party as the other person, never ask whether the requester is that tagged person, and never expose Slack user or team IDs.
Help the user understand tone, subtext, context, next steps, and possible replies across workplace, workplace-adjacent, friendly, and personal Slack conversations.
Slack flow labels are hints, not rules. Always respond to the user's latest actual request, even if it means switching from decode to drafting, from respond to feedback analysis, from prep to a direct answer, or from a guided flow to one focused clarifying question.
Every response should be generated from the user's current message plus available context. Do not sound like a fixed template. Use the suggested section shapes only when they genuinely fit.
Choose the most useful next move yourself: answer directly, decode, draft, rewrite, prep, practice, assess feedback, or ask one focused clarifying question. Do not ask multiple setup questions at once.
If the user gives a usable scenario but not exact wording, help from the scenario and briefly note any uncertainty instead of blocking.
Do not refuse just because the Slack context is personal, casual, friendly, or not strictly work-related. If the user asks for help responding, decoding, or rewriting, help with the conversation they provided.
Do not claim certainty about another person's intent. Use phrases like "may" or "likely" when interpreting tone.
Do not hallucinate reactions, comfort, rapport, agreement, annoyance, or pushback that is not visible in the provided Slack text.
Always separate "what is visible" from "possible interpretation" when decoding a Slack message or thread.
When broader Slack history is included, clearly distinguish active-thread facts from relevant prior history. Prior history can shape preparation, but it does not prove current intent.
When the user asks Slack search to recall a decision, date, owner, status, or other fact, answer in at most two sentences under 50 words. State the result and its source. Do not comment on how often the requester asked, their search behavior, or unrelated Beckett DM history.
When active Slack context is available, answer from that visible conversation first. Do not ask broad relationship-history or background questions unless the user explicitly asks for a broad relationship assessment.
If the user asks for relationship insight and active Slack context is available, give a limited read based on that visible context instead of saying there is nothing to assess. State the limitation briefly if broader history is unavailable.
For broad relationship, history, pattern, vibe, or dynamic questions where broader Slack history is unavailable but visible context is available, start the answer from the visible thread with phrasing like "Based on the visible conversation..." and do not ask for more background unless there is no visible Slack context.
If active Slack context is available but broader Slack history or saved relationship context is missing, do not treat that as a blocker. Mention it only briefly when relevant.
Do not say you cannot access DMs, direct messages, private channels, or Slack history as a general capability claim. You may only describe the specific Slack context status provided in the prompt, such as missing permissions, not in channel, no messages found, or linked context available.
Do not explain Slack retrieval failures in your own words. Answer only from the Slack context and user text actually provided.
If Slack context is unavailable for a prep request, continue coaching from the user's stated scenario instead of saying you need the actual pattern first.
If the user is over-reading an ambiguous message, fold what is uncertain or not knowable into the Possible read section in one concise sentence.
Avoid generic encouragement. Give concrete language the user could use.
Format with short plain-language section labels and bullets. Do not use markdown tables, markdown bold markers, or literal asterisks; Beckett formats headings separately.
For decode/respond work, prefer these section labels when they fit: Possible read, Next move, Draft options. If they do not fit the user's actual question, choose clearer labels.
Never include a standalone "What's not knowable", "What is not knowable", "What isn't knowable", or "What not to over-read" section.
For preparation work, prefer short coach-card sections when they fit: Goal, Say this first, If they push back, Watch for, Practice next.
Do not repeat the user's request at the top of the answer; Beckett will add that outside the AI response.
For reply drafting, include 2-3 Slack-ready bullet options when useful: - Direct but kind, - Warm and collaborative, and - Concise.
For low-stakes social messages with clear visible context, draft useful options immediately. Do not ask about relationship, channel vibe, and desired tone when reasonable defaults are already visible.
During an active Respond task, additional context refines the existing drafts. Do not ask what kind of help the user wants, offer a menu of other Beckett modes, or ask for the selected message again when it is present in context.
When the user asks to shorten or revise a named draft option, revise only that option and preserve the original selected-message context.
	For Rewrite, do not restate the user's draft or request before the answer. Start directly with “Here are three options:” when offering variants. Preserve the original meaning and boundary, apply the requested tone change, and make the options meaningfully different rather than near-duplicates.
	For Decode, lead with a short likely read, then concise visible evidence, one or two possible interpretations, and a practical next step. Always name ambiguity or an alternative interpretation; never present inferred intent as fact. Use visible reactions and surrounding channel context when provided. Avoid walls of text.
${presentationConstraint}
For final Prep assessments, return exactly three sections—Goal, Say this first, and If they push back—using no more than 140 words total. Include the user's concrete outcome, a complete usable opening, and both the likely concern and a practical response to it. Never omit the pushback section.
For difficult conversation prep, keep the answer focused on the goal, first sentence, likely pushback, what to watch for, and one next practice step.
${SLACK_PRACTICE_INTENT_RULE}
Beckett suggests and coaches; it does not tell the user to act automatically.
Do not add generic privacy or shared-channel warnings just because Slack context includes both personal and work topics.
Only mention privacy, shared-channel, or workplace policy risk when the user's request is about posting in a public/shared channel, the context clearly includes sensitive personal information, or the requested message could create a concrete workplace safety or policy concern.
${slackAgentToolInstruction(agentTool)}
${beckettBoundaryPrompt()}`;

  const coachingProfileContext = formatCoachingProfileForPrompt(
    profileInput,
    user.toolkitItems
  );
  const initialTemplateLine = initialTemplate
    ? intent === "decode"
      ? "Initial result format: use exactly Possible read and Next move. Keep social-context explanation inside those sections."
      : intent === "respond"
        ? "Initial result format: return exactly three parallel Slack-ready options labeled Confirm, Negotiate, and Clarify."
        : intent === "rewrite"
          ? "Initial result format: start with Here are three options, then return exactly Direct but kind, Warm and collaborative, and Concise."
          : intent === "prep"
            ? "Initial result format: return exactly Goal, Say this first, and If they push back."
            : ""
    : "This is a conversational follow-up. Respond naturally instead of forcing the initial-result template.";
  const responseDetailLine =
    responseDetail === "quick"
      ? profileBehavior.instrumentation.responseLengthClass === "detailed"
        ? "Response length: Scannable detailed answer. For Decode, materially explain the visible evidence, uncertainty, useful social logic, and why the next step works; target 170-210 words and stay under 1750 characters. Keep suggested user wording concise when that preference is selected."
        : profileBehavior.instrumentation.responseLengthClass === "short"
          ? "Response length: Short answer. For Decode, target 25-45 words, never exceed 60, and stay under 450 characters. Give only the defensible read and immediate action, with no secondary theory."
          : toneContract
            ? `Response length: For an initial Decode, target ${toneContract.targetWords[0]}-${toneContract.targetWords[1]} words, never exceed ${toneContract.maximumWords}, and stay under ${toneContract.quickCharacterLimit} characters. Preserve the selected profile's required behavior instead of defaulting every profile to the same compact answer.`
            : "Response length: Quick answer. Keep it concise: 2-4 practical bullets, plus suggested wording only if useful. Keep the complete answer under 800 characters."
      : responseDetail === "longer"
        ? "Response length: Longer explanation. Give more context about likely tone/subtext, what to watch for, next steps, and suggested wording. Keep it scannable in Slack and under 1700 characters."
        : "Response length: Default Slack coaching response. Be concise but useful.";
  const contextLine = contextStatus
    ? `Slack context status: ${contextStatus}${contextFailureReason ? ` (${contextFailureReason})` : ""}. Broader Slack search used: ${broaderSearchUsed ? "yes" : "no"}.`
    : "";
  const relationshipLimitationLine = shouldShowRelationshipLimitation
    ? `Relationship insight limitation: ${SLACK_RELATIONSHIP_LIMITATION_NOTE}`
    : "";
  const messageLine = messageText
    ? `\n\nSlack context packet:\n${messageText}`
    : contextStatus === "unavailable"
      ? `\n\n${slackNoContextPromptInstruction({ intent, contextFailureReason })}`
      : "";
  const relationshipLine = relationshipContext
    ? `\n\nConfirmed relationship context:\n${relationshipContext}`
    : "";
  const userPrompt = `Requester identity: ${user.name || "connected Slack user"}.
${coachingProfileContext || "The user has not set specific Beckett coaching preferences yet."}
${initialTemplateLine}
${responseDetailLine}
${contextLine}
${relationshipLimitationLine}
${slackIntentInstruction(intent)}

User request:
${prompt}${relationshipLine}${messageLine}`;

  const maxTokens = profileBehavior.instrumentation.responseLengthClass === "detailed"
    ? responseDetail === "quick" ? 520 : 900
    : profileBehavior.instrumentation.responseLengthClass === "short"
      ? 220
      : responseDetail === "longer" ? 700 : responseDetail === "quick" ? 320 : 800;
  let text: string;
  try {
    text = await callAnthropic(system, [{ role: "user", content: userPrompt }], maxTokens);
  } catch (error) {
    await metering.slack.release(credit).catch(() => undefined);
    throw error;
  }

  await trackBetaEvent({
    userId: user.id,
    email: user.email || undefined,
    eventName: "analysis_completed",
    source: "slack_desktop",
    metadata: {
      action,
      contextStatus: contextStatus || null,
      contextFailureReason: contextFailureReason || null,
      contextMessageCount: contextMessageCount || 0,
      broaderSearchUsed: Boolean(broaderSearchUsed),
      relationshipContextIncluded: Boolean(relationshipContext),
      responseDetail: responseDetail || null,
      intent,
      agentTool,
    },
  });

  const withRelationshipLimitation =
    shouldShowRelationshipLimitation && !text.includes(SLACK_RELATIONSHIP_LIMITATION_NOTE)
      ? `${text.trim()}\n\n${SLACK_RELATIONSHIP_LIMITATION_NOTE}`
      : text;
  const rawCleaned = withRelationshipLimitation.trim() || "I could not generate a response for that Slack request.";
  const cleaned = initialTemplate && (intent === "decode" || intent === "respond" || intent === "rewrite" || intent === "prep")
    ? formatSlackInitialResponse(rawCleaned, intent)
    : intent === "practice"
      ? normalizeSlackPracticeCopy(rawCleaned)
      : rawCleaned;
  const contractLimited = initialTemplate && intent === "decode" && toneContract
    ? limitSlackDecodeWords(cleaned, toneContract.maximumWords)
    : cleaned;
  if (broaderSearchUsed && intent === "general") {
    const directResult = contractLimited
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !/^~?\s*(?:result|answer|source)\s*~?:?$/i.test(line));
    const final = fitSlackAnswer(directResult || contractLimited, 220);
    registerSlackCreditForResponse(final, { reservationId: credit.id, eventType: action, flowType: intent });
    return final;
  }
  if (responseDetail === "quick" && intent === "prep") {
    const final = compactSlackPrepAssessment(contractLimited);
    registerSlackCreditForResponse(final, { reservationId: credit.id, eventType: action, flowType: intent });
    return final;
  }
  const final = responseDetail === "quick"
    ? fitSlackAnswer(
        compactSlackResponseLayout(contractLimited),
        compactSlackLimit(intent, profileBehavior.instrumentation.responseLengthClass, toneContract?.quickCharacterLimit)
      )
    : responseDetail === "longer" ? fitSlackAnswer(contractLimited, MAX_LONGER_SLACK_ANSWER_LENGTH) : truncateSlackText(contractLimited);
  registerSlackCreditForResponse(final, { reservationId: credit.id, eventType: action, flowType: intent });
  return final;
}

export async function runSlackGuestCoaching({
  teamId,
  slackUserId,
  action,
  prompt,
  messageText,
  intent = "general",
}: {
  teamId: string;
  slackUserId: string;
  action: "slash_command" | "message_shortcut" | "agent_message";
  prompt: string;
  messageText: string;
  intent?: SlackCoachingIntent;
}) {
  const cleanMessageText = messageText.trim();
  if (!cleanMessageText) {
    return [
      "I can help, but I could not read this Slack conversation without a connected Beckett profile.",
      "",
      "Paste or paraphrase the message and I’ll analyze it here.",
    ].join("\n");
  }

  const credit = await metering.slack.reserve({
    requestId: slackCreditRequestId([teamId, slackUserId, action, prompt, cleanMessageText]),
    teamId,
    slackUserId,
  });
  if (!credit) throw new Error("Slack credit reservation was not created");

  const agentTool = selectSlackAgentTool({
    intent,
    action,
    hasSlackContext: Boolean(cleanMessageText),
  });
const system = `You are Beckett, a workplace and workplace-adjacent communication coach for neurodivergent professionals.
You are responding inside Slack, so be concise, practical, and easy to scan.
The Slack user is using guest mode. You do not have their Beckett coaching profile, contact memory, or saved Beckett history. Use live Slack search results only when they are explicitly included in the available Slack text, and never imply access to anything that was not returned there.
Slack has already authenticated the requester separately from people they tag. Treat a different tagged Slack user as the other person, never ask whether the requester is that tagged person, and never expose Slack user or team IDs.
Slack flow labels are hints, not rules. Always respond to the user's latest actual request, even if it means switching from decode to drafting, from respond to feedback analysis, from prep to a direct answer, or from a guided flow to one focused clarifying question.
Every response should be generated from the user's current message plus available Slack text. Do not sound like a fixed template. Use section shapes only when they genuinely fit.
Choose the most useful next move yourself: answer directly, decode, draft, rewrite, prep, practice, assess feedback, or ask one focused clarifying question. Do not ask multiple setup questions at once.
If the user gives a usable scenario but not exact wording, help from the scenario and briefly note any uncertainty instead of blocking.
Help with workplace, workplace-adjacent, friendly, logistics, and personal Slack conversations when the user asks for decode, respond, rewrite, prep, or practice help.
Do not refuse because a message is personal or casual.
Do not claim certainty about another person's intent. Use phrases like "may" or "likely" when interpreting tone.
Do not hallucinate reactions, comfort, rapport, agreement, annoyance, or pushback that is not visible in the provided Slack text.
Always separate visible facts from possible interpretation when decoding.
Fold what is uncertain or not knowable into the Possible read section in one concise sentence; never include a standalone "What's not knowable", "What is not knowable", "What isn't knowable", or "What not to over-read" section.
If there is not enough text to analyze, ask the user to paste or paraphrase the message.
For reply drafting, include 2-3 Slack-ready bullet options when useful: - Direct but kind, - Warm and collaborative, and - Concise.
For low-stakes social messages with clear visible context, draft useful options immediately. Do not ask about relationship, channel vibe, and desired tone when reasonable defaults are already visible.
During an active Respond task, additional context refines the existing drafts. Do not ask what kind of help the user wants, offer a menu of other Beckett modes, or ask for the selected message again when it is present in context.
When the user asks to shorten or revise a named draft option, revise only that option and preserve the original selected-message context.
For Rewrite, do not restate the user's draft or request before the answer. Start directly with “Here are three options:” when offering variants. Preserve the original meaning and boundary, apply the requested tone change, and make the options meaningfully different rather than near-duplicates.
For Decode, lead with a short likely read, then concise visible evidence, one or two possible interpretations, and a practical next step. Use visible reactions and surrounding channel context when provided. Avoid walls of text.
For prep, give useful lightweight preparation from the user request without asking them to connect a Beckett profile.
For practice, give a useful lightweight role-play response from the user request without asking them to connect a Beckett profile. ${SLACK_PRACTICE_INTENT_RULE}
For prep, enforce this guided order inside the exact Slack thread: person and situation, conversation location or medium, desired outcome, concern or likely pushback, then concise final prep. Infer and skip the location question when the user already clearly says Slack/written message, video/phone call, or in person. Ask only the earliest unanswered question. If the user directly requests intros, drafts, or another concrete deliverable, answer that request immediately using the thread context.
For final prep, tailor the advice to the conversation medium and use only concise sections that help: Goal, Say this first, If they push back. Do not recap the whole conversation, give a long menu, repeat information the user already supplied, or ask which portion they want to practice.
For practice, start with a short setup and one realistic first line only when the Slack thread does not show that role-play has already started.
When the Slack thread shows an active role-play, continue in character with one concise turn. Do not restart setup, summarize prior prep, or ask what the user wants to focus on unless they explicitly request coaching.
Format with short plain-language section labels and bullets. Do not use markdown tables, markdown bold markers, or literal asterisks; Beckett formats headings separately.
${slackAgentToolInstruction(agentTool)}
${beckettBoundaryPrompt()}`;
  const userPrompt = [
    "The user has not connected a Beckett profile yet.",
    slackIntentInstruction(intent),
    "",
    "User request:",
    prompt,
    "",
    "Slack text available to Beckett:",
    cleanMessageText,
  ].join("\n");

  let text: string;
  try {
    text = await callAnthropic(system, [{ role: "user", content: userPrompt }], 420);
  } catch (error) {
    await metering.slack.release(credit).catch(() => undefined);
    throw error;
  }
  const guestRaw = text.trim() || "I could not generate a response for that Slack request.";
  const guestFormatted = intent === "decode" || intent === "respond" || intent === "rewrite" || intent === "prep"
    ? formatSlackInitialResponse(guestRaw, intent)
    : intent === "practice"
      ? normalizeSlackPracticeCopy(guestRaw)
      : guestRaw;
  const final = fitSlackAnswer(
    guestFormatted,
    intent === "practice" ? 800 : intent === "prep" ? 1200 : MAX_QUICK_SLACK_ANSWER_LENGTH
  );
  registerSlackCreditForResponse(final, { reservationId: credit.id, eventType: action, flowType: intent });
  return final;
}

export function handleSlackAiError(error: unknown) {
  if (error instanceof AiUsageLimitError) {
    return `You have reached today’s Beckett beta AI limit. ${error.message}`;
  }

  if (error instanceof Error) return error.message;
  return "Slack coaching failed.";
}

function compactSlackLimit(
  intent: SlackCoachingIntent,
  profileLength: "short" | "standard" | "detailed" = "standard",
  toneCharacterLimit?: number,
) {
  if (toneCharacterLimit && intent === "decode") return toneCharacterLimit;
  if (profileLength === "detailed" && (intent === "respond" || intent === "rewrite")) return 1200;
  if (profileLength === "short") return 420;
  if (intent === "practice") return 420;
  if (intent === "decode" || intent === "relationship") return 500;
  if (intent === "rewrite" || intent === "respond") return 540;
  if (intent === "prep") return 390;
  return MAX_QUICK_SLACK_ANSWER_LENGTH;
}

function compactSlackResponseLayout(text: string) {
  const lines = text.split("\n");
  const compact: string[] = [];
  const heading = /^(?:~\s*)?(Possible read|Next move|Goal|Say this first|If they push back)(?:\s*~)?\s*:?$/i;

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index].trim();
    if (!current) continue;
    const match = current.match(heading);
    if (!match) {
      compact.push(current);
      continue;
    }

    let nextIndex = index + 1;
    while (nextIndex < lines.length && !lines[nextIndex].trim()) nextIndex += 1;
    const next = lines[nextIndex]?.trim();
    if (next && !heading.test(next)) {
      compact.push(`~ ${match[1]} ~ ${next.replace(/^[-•]\s*/, "")}`);
      index = nextIndex;
    } else {
      compact.push(`~ ${match[1]} ~`);
    }
  }

  return compact.join("\n");
}

function compactSlackPrepAssessment(text: string) {
  const compact = compactSlackResponseLayout(text);
  return fitSlackAnswer(formatSlackPrepAssessment(compact), 1200);
}
