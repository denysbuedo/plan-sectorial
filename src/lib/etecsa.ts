const ETECSA_BASE_URL = process.env.ETECSA_API_URL || "http://192.168.1.100";
const ETECSA_USERNAME = process.env.ETECSA_USERNAME || "api.mes";
const ETECSA_PASSWORD = process.env.ETECSA_PASSWORD || "mypassword";
const SECTORIAL_PLAN_CODE = "506";

// Simple in-memory token cache
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get authentication token from ETECSA API
 */
async function getAuthToken(): Promise<string | null> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  try {
    const res = await fetch(`${ETECSA_BASE_URL}/auth/v1/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: ETECSA_USERNAME,
        password: ETECSA_PASSWORD,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[ETECSA] Auth failed:", res.status);
      return null;
    }

    const data = await res.json();
    cachedToken = data.token;
    tokenExpiresAt = new Date(data.expires_at).getTime();
    return cachedToken;
  } catch (err) {
    console.error("[ETECSA] Auth error:", err);
    return null;
  }
}

export interface EtecsaAnalyzeResponse {
  isClient: boolean;
  hasMobileSubscriptionsActive: boolean;
  isChannelConfirmed: boolean;
  isChannelConfigured: boolean;
  isConfigured: boolean;
}

export interface EtecsaAltaPayload {
  docType: number;
  document: string;
  entity: string;
  sectorialPlan?: string;
}

export interface EtecsaBajaPayload {
  docType: number;
  document: string;
}

export interface EtecsaOperationResult {
  success: boolean;
  error?: string;
}

export interface EtecsaAnalyzeResult {
  success: boolean;
  data?: EtecsaAnalyzeResponse;
  error?: string;
}

/**
 * Analyze a student's status in ETECSA
 */
export async function analyzeStudent(
  document: string,
  docType: number
): Promise<EtecsaAnalyzeResult> {
  const token = await getAuthToken();
  if (!token) {
    return { success: false, error: "auth_failed" };
  }

  try {
    const url = `${ETECSA_BASE_URL}/special-segments/v1/mes/analyze?document=${document}&document_type=${docType}&subsegment=${SECTORIAL_PLAN_CODE}`;
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return { success: false, error: `http_${res.status}` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "network_error",
    };
  }
}

/**
 * Register (ALTA) a student in ETECSA
 */
export async function altaStudent(
  payload: EtecsaAltaPayload
): Promise<EtecsaOperationResult> {
  const token = await getAuthToken();
  if (!token) {
    return { success: false, error: "auth_failed" };
  }

  try {
    const url = `${ETECSA_BASE_URL}/special-segments/v1/MES/`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        data: [{ ...payload, sectorialPlan: payload.sectorialPlan || SECTORIAL_PLAN_CODE }],
      }),
      cache: "no-store",
    });

    if (res.ok || res.status === 201) {
      return { success: true };
    }

    if (res.status === 422) {
      return { success: false, error: "validation_error" };
    }

    if (res.status === 409) {
      return { success: false, error: "conflict" };
    }

    return { success: false, error: `http_${res.status}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "network_error",
    };
  }
}

/**
 * Deregister (BAJA) a student from ETECSA
 */
export async function bajaStudent(
  payload: EtecsaBajaPayload
): Promise<EtecsaOperationResult> {
  const token = await getAuthToken();
  if (!token) {
    return { success: false, error: "auth_failed" };
  }

  try {
    const url = `${ETECSA_BASE_URL}/special-segments/v1/MES/`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data: [payload] }),
      cache: "no-store",
    });

    if (res.ok || res.status === 200) {
      return { success: true };
    }

    if (res.status === 422) {
      return { success: false, error: "validation_error" };
    }

    if (res.status === 404) {
      return { success: false, error: "not_found" };
    }

    return { success: false, error: `http_${res.status}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "network_error",
    };
  }
}
