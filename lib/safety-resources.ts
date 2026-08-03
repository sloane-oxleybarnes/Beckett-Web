export type SafetyTopic = "crisis" | "relationship_safety" | "health" | "legal";

export const safetyResourceRegions = [
  { value: "US", label: "United States", emergencyNumber: "911", language: "English / Spanish" },
  { value: "CA", label: "Canada", emergencyNumber: "911", language: "English / French" },
  { value: "GB", label: "United Kingdom", emergencyNumber: "999 or 112", language: "English" },
  { value: "AU", label: "Australia", emergencyNumber: "000", language: "English" },
  { value: "OTHER", label: "Another country or region", emergencyNumber: "your local emergency number", language: "International directories" },
] as const;

export type SafetyResourceRegion = (typeof safetyResourceRegions)[number]["value"];
export const DEFAULT_SAFETY_RESOURCE_REGION: SafetyResourceRegion = "US";
export const SAFETY_RESOURCE_REVIEW_CADENCE_DAYS = 90;
export const SAFETY_RESOURCE_OWNER = "Beckett safety content team";

export type SafetyReviewStatus = "current" | "due" | "overdue";
export type SafetyResourceLink = {
  label: string;
  href: string;
  kind: "crisis" | "specialist" | "directory" | "government";
};

export type SafetyResponse = {
  topic: SafetyTopic;
  title: string;
  message: string;
  resources: SafetyResourceLink[];
  owner: string;
  source: string;
  reviewedAt: string;
  nextReviewAt: string;
  reviewCadenceDays: number;
  reviewStatus: SafetyReviewStatus;
  region: SafetyResourceRegion;
  regionLabel: string;
  emergencyNumber: string;
  language: string;
  usingUSFallback: boolean;
};

type SafetyResourceTemplate = Omit<SafetyResponse, "region" | "regionLabel" | "emergencyNumber" | "reviewStatus" | "usingUSFallback">;

const REVIEWED_AT = "2026-07-22";

const TOPIC_PATTERNS: Array<{ topic: SafetyTopic; pattern: RegExp }> = [
  {
    topic: "crisis",
    pattern: /\b(immediate danger|emergency|kill myself|suicid(?:e|al)|self[- ]harm|hurt myself|end my life|want to die|can'?t keep myself safe)\b/i,
  },
  {
    topic: "relationship_safety",
    pattern: /\b(domestic (?:abuse|violence)|abusive partner|partner (?:hits|hurts|threatens) me|being stalked|stalking|restraining order|coercive control|unsafe at home|afraid of (?:my )?partner)\b/i,
  },
  {
    topic: "health",
    pattern: /\b(diagnos(?:e|is)|medication|therapy|therapist|panic attack|psychosis|manic|mental health crisis|medical advice|doctor|hospital|overdose|withdrawal)\b/i,
  },
  {
    topic: "legal",
    pattern: /\b(lawsuit|sue|legal advice|attorney|lawyer|court|police report|employment law|discrimination claim|retaliation claim|wrongful termination)\b/i,
  },
];

function template(
  topic: SafetyTopic,
  title: string,
  message: string,
  resources: SafetyResourceLink[],
  source: string,
  language: string,
): SafetyResourceTemplate {
  const nextReview = new Date(`${REVIEWED_AT}T00:00:00Z`);
  nextReview.setUTCDate(nextReview.getUTCDate() + SAFETY_RESOURCE_REVIEW_CADENCE_DAYS);
  return {
    topic,
    title,
    message,
    resources,
    owner: SAFETY_RESOURCE_OWNER,
    source,
    reviewedAt: REVIEWED_AT,
    nextReviewAt: nextReview.toISOString().slice(0, 10),
    reviewCadenceDays: SAFETY_RESOURCE_REVIEW_CADENCE_DAYS,
    language,
  };
}

const resource = (label: string, href: string, kind: SafetyResourceLink["kind"]): SafetyResourceLink => ({ label, href, kind });

const RESOURCE_CATALOG: Record<SafetyResourceRegion, Record<SafetyTopic, SafetyResourceTemplate>> = {
  US: {
    crisis: template("crisis", "Immediate support matters here", "Beckett cannot provide crisis intervention. If you may be in immediate danger or might hurt yourself, call 911 or go to the nearest emergency department. In the U.S., call or text 988 for the Suicide & Crisis Lifeline.", [
      resource("988 Suicide & Crisis Lifeline", "https://988lifeline.org/", "crisis"),
      resource("Find a Helpline (international directory)", "https://findahelpline.com/", "directory"),
    ], "988 Suicide & Crisis Lifeline; SAMHSA", "English / Spanish"),
    relationship_safety: template("relationship_safety", "Your safety comes first", "Beckett cannot provide safety planning or advice for abuse, coercion, or stalking. If you are in immediate danger, call 911. For confidential U.S. support, contact the National Domestic Violence Hotline or a local advocate.", [
      resource("National Domestic Violence Hotline", "https://www.thehotline.org/", "specialist"),
      resource("RAINN National Sexual Assault Hotline", "https://rainn.org/resources", "specialist"),
      resource("NO MORE Global Directory", "https://nomoredirectory.org/", "directory"),
    ], "National Domestic Violence Hotline; RAINN", "English / Spanish"),
    health: template("health", "This needs qualified support", "Beckett cannot provide medical or mental-health advice. For urgent danger call 911; for a mental-health crisis call or text 988. A licensed clinician, care team, or local support service can help with the underlying issue.", [
      resource("988 Suicide & Crisis Lifeline", "https://988lifeline.org/", "crisis"),
      resource("SAMHSA FindTreatment.gov", "https://findtreatment.gov/", "government"),
      resource("Find a Helpline (international directory)", "https://findahelpline.com/", "directory"),
    ], "SAMHSA; 988 Suicide & Crisis Lifeline", "English / Spanish"),
    legal: template("legal", "This requires local legal guidance", "Beckett cannot provide legal advice or assess a legal dispute. Consider your employee handbook, HR process, legal aid, or a qualified lawyer licensed where the issue occurred. If there is immediate danger, call 911.", [
      resource("Legal Services Corporation — find legal aid", "https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help", "government"),
      resource("U.S. Equal Employment Opportunity Commission", "https://www.eeoc.gov/", "government"),
      resource("LawHelp.org", "https://www.lawhelp.org/", "directory"),
    ], "Legal Services Corporation; U.S. Equal Employment Opportunity Commission", "English / Spanish"),
  },
  CA: {
    crisis: template("crisis", "Immediate support matters here", "Beckett cannot provide crisis intervention. If you may be in immediate danger, call 911 or go to the nearest emergency department. In Canada, call or text 988 for the Suicide Crisis Helpline.", [
      resource("988 Suicide Crisis Helpline Canada", "https://988.ca/", "crisis"),
      resource("Crisis Services Canada", "https://www.crisisservicescanada.ca/", "specialist"),
      resource("Find a Helpline (international directory)", "https://findahelpline.com/", "directory"),
    ], "988 Suicide Crisis Helpline Canada; Crisis Services Canada", "English / French"),
    relationship_safety: template("relationship_safety", "Your safety comes first", "Beckett cannot provide safety planning or advice for abuse, coercion, or stalking. If you are in immediate danger, call 911. ShelterSafe can help you find a nearby shelter or crisis line without requiring Beckett to infer your location.", [
      resource("ShelterSafe Canada", "https://sheltersafe.ca/", "specialist"),
      resource("Canadian Human Trafficking Hotline", "https://canadianhumantraffickinghotline.ca/", "specialist"),
      resource("NO MORE Global Directory", "https://nomoredirectory.org/", "directory"),
    ], "ShelterSafe; Canadian Human Trafficking Hotline", "English / French"),
    health: template("health", "This needs qualified support", "Beckett cannot provide medical or mental-health advice. For immediate danger call 911; for a crisis call or text 988. Provincial health services and a licensed clinician can provide advice that fits your location.", [
      resource("988 Suicide Crisis Helpline Canada", "https://988.ca/", "crisis"),
      resource("Canada.ca — mental health support", "https://www.canada.ca/en/public-health/services/mental-health-services/mental-health-get-help.html", "government"),
      resource("Find a Helpline (international directory)", "https://findahelpline.com/", "directory"),
    ], "Government of Canada; 988 Suicide Crisis Helpline Canada", "English / French"),
    legal: template("legal", "This requires local legal guidance", "Beckett cannot provide legal advice or assess a legal dispute. Consider your employer’s process, a provincial legal-aid service, or a lawyer licensed in the relevant province or territory. If there is immediate danger, call 911.", [
      resource("Legal Aid Canada", "https://www.justice.gc.ca/eng/fund-fina/gov-gouv/aid-aide.html", "government"),
      resource("Canadian Human Rights Commission", "https://www.chrc-ccdp.ca/en/complaints", "government"),
      resource("211 Canada", "https://211.ca/", "directory"),
    ], "Government of Canada; Canadian Human Rights Commission", "English / French"),
  },
  GB: {
    crisis: template("crisis", "Immediate support matters here", "Beckett cannot provide crisis intervention. If you may be in immediate danger, call 999 or 112, or go to A&E. Samaritans is available free, day or night, on 116 123.", [
      resource("Samaritans — call 116 123", "https://www.samaritans.org/how-we-can-help/contact-samaritan/", "crisis"),
      resource("NHS urgent mental-health help", "https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/behaviours/where-to-get-urgent-help-for-mental-health/", "government"),
      resource("Find a Helpline (international directory)", "https://findahelpline.com/", "directory"),
    ], "Samaritans; NHS", "English"),
    relationship_safety: template("relationship_safety", "Your safety comes first", "Beckett cannot provide safety planning or advice for abuse, coercion, or stalking. If you are in immediate danger, call 999. Refuge and Women’s Aid can help you find confidential specialist support in the UK.", [
      resource("Refuge National Domestic Abuse Helpline", "https://www.nationaldahelpline.org.uk/", "specialist"),
      resource("Women’s Aid", "https://www.womensaid.org.uk/", "specialist"),
      resource("NO MORE Global Directory", "https://nomoredirectory.org/", "directory"),
    ], "Refuge; Women’s Aid", "English"),
    health: template("health", "This needs qualified support", "Beckett cannot provide medical or mental-health advice. For immediate danger call 999 or 112. For urgent mental-health help use NHS 111 or the NHS urgent-help route; a clinician can advise on your circumstances.", [
      resource("NHS urgent mental-health help", "https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/behaviours/where-to-get-urgent-help-for-mental-health/", "government"),
      resource("Samaritans — call 116 123", "https://www.samaritans.org/how-we-can-help/contact-samaritan/", "crisis"),
      resource("NHS 111 online", "https://111.nhs.uk/", "government"),
    ], "NHS; Samaritans", "English"),
    legal: template("legal", "This requires local legal guidance", "Beckett cannot provide legal advice or assess a legal dispute. Consider ACAS, Citizens Advice, your employer’s process, or a solicitor qualified in the relevant UK jurisdiction. If there is immediate danger, call 999.", [
      resource("ACAS — workplace advice", "https://www.acas.org.uk/", "government"),
      resource("Citizens Advice", "https://www.citizensadvice.org.uk/", "government"),
      resource("Law Centres Network", "https://www.lawcentres.org.uk/", "directory"),
    ], "ACAS; Citizens Advice", "English"),
  },
  AU: {
    crisis: template("crisis", "Immediate support matters here", "Beckett cannot provide crisis intervention. If you may be in immediate danger, call 000 or go to the nearest emergency department. Lifeline Australia is available on 13 11 14.", [
      resource("Lifeline Australia — call 13 11 14", "https://www.lifeline.org.au/crisis-chat/", "crisis"),
      resource("Beyond Blue Support Service", "https://www.beyondblue.org.au/get-support", "specialist"),
      resource("Find a Helpline (international directory)", "https://findahelpline.com/", "directory"),
    ], "Lifeline Australia; Beyond Blue", "English"),
    relationship_safety: template("relationship_safety", "Your safety comes first", "Beckett cannot provide safety planning or advice for abuse, coercion, or stalking. If you are in immediate danger, call 000. 1800RESPECT provides confidential specialist support across Australia.", [
      resource("1800RESPECT", "https://www.1800respect.org.au/", "specialist"),
      resource("Safe Steps Family Violence Response Centre", "https://www.safesteps.org.au/", "specialist"),
      resource("NO MORE Global Directory", "https://nomoredirectory.org/", "directory"),
    ], "1800RESPECT; Safe Steps", "English"),
    health: template("health", "This needs qualified support", "Beckett cannot provide medical or mental-health advice. For immediate danger call 000. Healthdirect and a licensed clinician can help with advice appropriate to your symptoms and location.", [
      resource("Healthdirect", "https://www.healthdirect.gov.au/", "government"),
      resource("Lifeline Australia — call 13 11 14", "https://www.lifeline.org.au/crisis-chat/", "crisis"),
      resource("Beyond Blue Support Service", "https://www.beyondblue.org.au/get-support", "specialist"),
    ], "Healthdirect; Lifeline Australia; Beyond Blue", "English"),
    legal: template("legal", "This requires local legal guidance", "Beckett cannot provide legal advice or assess a legal dispute. Consider your state or territory legal-aid service, Fair Work Ombudsman, or a lawyer qualified in the relevant jurisdiction. If there is immediate danger, call 000.", [
      resource("Fair Work Ombudsman", "https://www.fairwork.gov.au/", "government"),
      resource("National Legal Aid", "https://legalaidmatters.org.au/", "government"),
      resource("Australian Human Rights Commission", "https://humanrights.gov.au/complaints", "government"),
    ], "Fair Work Ombudsman; National Legal Aid", "English"),
  },
  OTHER: {
    crisis: template("crisis", "Immediate support matters here", "Beckett cannot provide crisis intervention. If you may be in immediate danger or might hurt yourself, contact your local emergency services now or go to the nearest emergency department. Find A Helpline can help identify a service in your country.", [
      resource("Find a Helpline — international directory", "https://findahelpline.com/", "directory"),
      resource("NO MORE Global Directory", "https://nomoredirectory.org/", "directory"),
    ], "Find A Helpline; NO MORE Global Directory", "International directory"),
    relationship_safety: template("relationship_safety", "Your safety comes first", "Beckett cannot provide safety planning or advice for abuse, coercion, or stalking. If you are in immediate danger, contact your local emergency services. Use the directories below to find a specialist service in your country.", [
      resource("NO MORE Global Directory", "https://nomoredirectory.org/", "directory"),
      resource("Find a Helpline — international directory", "https://findahelpline.com/", "directory"),
    ], "NO MORE Global Directory; Find A Helpline", "International directory"),
    health: template("health", "This needs qualified support", "Beckett cannot provide medical or mental-health advice. Contact a licensed local clinician or health service. If there is immediate danger, use your local emergency number or go to the nearest emergency department.", [
      resource("Find a Helpline — international directory", "https://findahelpline.com/", "directory"),
      resource("World Health Organization — mental health", "https://www.who.int/health-topics/mental-health", "government"),
    ], "Find A Helpline; World Health Organization", "International directory"),
    legal: template("legal", "This requires local legal guidance", "Beckett cannot provide legal advice or assess a legal dispute. Contact a lawyer or legal-aid organization qualified in the country and jurisdiction where the issue occurred. If there is immediate danger, contact local emergency services.", [
      resource("International Legal Aid Directory", "https://www.internationallegalaid.org/", "directory"),
      resource("Find a Helpline — international directory", "https://findahelpline.com/", "directory"),
    ], "International Legal Aid; Find A Helpline", "International directory"),
  },
};

export function normalizeSafetyResourceRegion(region: unknown): SafetyResourceRegion {
  return safetyResourceRegions.some((option) => option.value === region)
    ? region as SafetyResourceRegion
    : DEFAULT_SAFETY_RESOURCE_REGION;
}

export function safetyResourceRegionLabel(region: SafetyResourceRegion) {
  return safetyResourceRegions.find((option) => option.value === region)?.label || "United States";
}

export function safetyResourceRegionDetails(region: SafetyResourceRegion) {
  return safetyResourceRegions.find((option) => option.value === region) || safetyResourceRegions[0];
}

export function getSafetyReviewStatus(reviewedAt: string, nextReviewAt: string, asOf = new Date()): SafetyReviewStatus {
  const now = asOf.getTime();
  const next = new Date(`${nextReviewAt}T23:59:59Z`).getTime();
  const reviewed = new Date(`${reviewedAt}T00:00:00Z`).getTime();
  if (Number.isNaN(next) || Number.isNaN(reviewed)) return "due";
  if (now > next) return "overdue";
  if (now >= reviewed && now >= new Date(`${nextReviewAt}T00:00:00Z`).getTime() - 14 * 24 * 60 * 60 * 1000) return "due";
  return "current";
}

function forRegion(response: SafetyResourceTemplate, region: SafetyResourceRegion): SafetyResponse {
  const details = safetyResourceRegionDetails(region);
  return {
    ...response,
    region,
    regionLabel: details.label,
    emergencyNumber: details.emergencyNumber,
    reviewStatus: getSafetyReviewStatus(response.reviewedAt, response.nextReviewAt),
    usingUSFallback: region === "OTHER",
  };
}

export function getSafetyResourceRegionNotice(region: SafetyResourceRegion) {
  if (region === "US") return "You are viewing Beckett's reviewed U.S. resource set.";
  if (region === "OTHER") return "Beckett does not infer your location or claim that an international directory is local advice. Because you selected another country or region, Beckett is showing international directories and clearly labels the fallback. Use your local emergency number for immediate danger.";
  return `You are viewing Beckett's reviewed ${safetyResourceRegionLabel(region)} resource set. Beckett uses this choice only for safety-resource routing and does not use it to infer your precise location.`;
}

export function getSafetyResponse(text: string, region?: unknown): SafetyResponse | null {
  const matched = TOPIC_PATTERNS.find(({ pattern }) => pattern.test(text));
  return matched ? forRegion(RESOURCE_CATALOG[normalizeSafetyResourceRegion(region)][matched.topic], normalizeSafetyResourceRegion(region)) : null;
}

export function allSafetyResources(region?: unknown) {
  const normalizedRegion = normalizeSafetyResourceRegion(region);
  return Object.values(RESOURCE_CATALOG[normalizedRegion]).map((response) => forRegion(response, normalizedRegion));
}

export function getSafetyResourceCatalogForReview() {
  return safetyResourceRegions.flatMap((region) => allSafetyResources(region.value));
}
