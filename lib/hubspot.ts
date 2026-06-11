const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const BASE_URL = "https://api.hubspot.com";

type HubSpotPropertyValue = string | number | boolean | null | undefined;

interface HubSpotContact {
  email: string;
  firstname?: string;
  lastname?: string;
  plan?: string;
  source?: string;
  extension_installed?: boolean;
  properties?: Record<string, HubSpotPropertyValue>;
}

let contactPropertyCache: Set<string> | null = null;

export const BECKETT_CONTACT_PROPERTIES = [
  "beckett_beta_status",
  "beckett_source",
  "beckett_plan",
  "beckett_approved_at",
  "beckett_invited_at",
  "beckett_password_set_at",
  "beckett_onboarding_completed_at",
  "beckett_extension_connected_at",
  "beckett_gmail_connected_at",
  "beckett_slack_connected_at",
  "beckett_first_analysis_at",
  "beckett_last_active_at",
  "beckett_analysis_count",
  "beckett_course_count",
  "beckett_feedback_count",
];

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${HUBSPOT_API_KEY}`,
  };
}

async function getContactProperties() {
  if (!HUBSPOT_API_KEY) return new Set<string>();
  if (contactPropertyCache) return contactPropertyCache;

  try {
    const res = await fetch(`${BASE_URL}/crm/v3/properties/contacts?archived=false`, {
      headers: authHeaders(),
    });

    if (!res.ok) {
      console.error("HubSpot property lookup error:", await res.text());
      contactPropertyCache = new Set(["email", "firstname", "lastname"]);
      return contactPropertyCache;
    }

    const data = await res.json() as { results?: { name?: string }[] };
    contactPropertyCache = new Set((data.results || []).map((property) => property.name || ""));
    return contactPropertyCache;
  } catch (err) {
    console.error("HubSpot property lookup error:", err);
    contactPropertyCache = new Set(["email", "firstname", "lastname"]);
    return contactPropertyCache;
  }
}

async function filterContactProperties(properties: Record<string, HubSpotPropertyValue>) {
  const availableProperties = await getContactProperties();
  const filtered: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined || value === "") continue;
    if (!availableProperties.has(key)) continue;
    filtered[key] = value;
  }

  return filtered;
}

async function getExistingContactId(email: string) {
  if (!HUBSPOT_API_KEY) return null;

  const res = await fetch(`${BASE_URL}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: "EQ",
              value: email,
            },
          ],
        },
      ],
      properties: ["email"],
      limit: 1,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json() as { results?: { id?: string }[] };
  return data.results?.[0]?.id || null;
}

export async function createOrUpdateHubSpotContact(
  contact: HubSpotContact
): Promise<string | null> {
  if (!HUBSPOT_API_KEY) return null;

  try {
    const legacyProperties: Record<string, HubSpotPropertyValue> = {
      lumen_plan: contact.plan || "free",
      lumen_source: contact.source || "website",
      lumen_extension_installed: contact.extension_installed,
    };

    const beckettProperties: Record<string, HubSpotPropertyValue> = {
      beckett_plan: contact.plan || "beta",
      beckett_source: contact.source || "website",
      ...(contact.properties || {}),
    };

    if (contact.extension_installed !== undefined) {
      beckettProperties.beckett_extension_connected_at = contact.extension_installed
        ? new Date().toISOString()
        : undefined;
    }

    const properties = await filterContactProperties({
      email: contact.email,
      firstname: contact.firstname || "",
      lastname: contact.lastname || "",
      ...legacyProperties,
      ...beckettProperties,
    });

    const existingId = await getExistingContactId(contact.email);

    if (existingId) {
      const updateRes = await fetch(`${BASE_URL}/crm/v3/objects/contacts/${existingId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ properties }),
      });

      if (!updateRes.ok) {
        console.error("HubSpot update error:", await updateRes.text());
        return null;
      }

      return existingId;
    }

    const res = await fetch(`${BASE_URL}/crm/v3/objects/contacts`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ properties }),
    });

    if (!res.ok) {
      console.error("HubSpot create error:", await res.text());
      return null;
    }

    const data = await res.json();
    return data.id || null;
  } catch (err) {
    console.error("HubSpot error:", err);
    return null;
  }
}

export async function createHubSpotDeal(params: {
  contactId: string;
  dealName: string;
  amount: number;
  stage: string;
  plan: string;
}): Promise<string | null> {
  if (!HUBSPOT_API_KEY) return null;

  try {
    const res = await fetch(`${BASE_URL}/crm/v3/deals`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        properties: {
          dealname: params.dealName,
          amount: params.amount,
          dealstage: params.stage,
          pipeline: "default",
          lumen_plan: params.plan,
        },
        associations: [
          {
            to: { id: params.contactId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: 3,
              },
            ],
          },
        ],
      }),
    });
    const data = await res.json();
    return data.id || null;
  } catch (err) {
    console.error("HubSpot deal error:", err);
    return null;
  }
}

export async function createHubSpotCompany(params: {
  name: string;
  contactId: string;
  plan: string;
}): Promise<string | null> {
  if (!HUBSPOT_API_KEY) return null;

  try {
    const res = await fetch(`${BASE_URL}/crm/v3/companies`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        properties: {
          name: params.name,
          lumen_plan: params.plan,
        },
        associations: [
          {
            to: { id: params.contactId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: 1,
              },
            ],
          },
        ],
      }),
    });
    const data = await res.json();
    return data.id || null;
  } catch (err) {
    console.error("HubSpot company error:", err);
    return null;
  }
}
