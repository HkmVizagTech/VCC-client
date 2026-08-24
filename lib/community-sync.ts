const BASE_URL =
  process.env.COMMUNITY_APP_API_URL ||
  "https://harekrishnavizag.co.in/api/v1/user/festivals";

async function post(endpoint: string, body: Record<string, string>) {
  try {
    const res = await fetch(`${BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; ISKCON-SevaPass/1.0; +https://harekrishnavizag.org)",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[community-sync] ${endpoint} ${res.status}: ${text}`);
    }
  } catch (err) {
    console.error(`[community-sync] ${endpoint} failed:`, err);
  }
}

export function syncAssignSeva(
  eventId: string,
  serviceName: string,
  volunteerPhone: string,
  devoteePhone?: string
) {
  post("assign-seva", {
    service_name: serviceName,
    event_id: eventId,
    volunteer_mobile_number: volunteerPhone,
    devotee_mobile_number: devoteePhone || volunteerPhone,
  });
}

export function syncMarkAttendance(
  eventId: string,
  volunteerPhone: string,
  isPresent: boolean
) {
  post("mark-attendance", {
    event_id: eventId,
    volunteer_mobile_number: volunteerPhone,
    is_present: isPresent ? "yes" : "no",
  });
}
