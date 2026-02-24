const ETECSA_BASE_URL = process.env.ETECSA_API_URL || "http://ip";
const SECTORIAL_PLAN_CODE = "506";

export interface EtecsaAnalyzeResponse {
  isClient: boolean;
  hasMobileSubscriptionsActive: boolean;
  isChannelConfirmed: boolean;
  isChannelConfigured: boolean;
  isConfigured: boolean;
}

export interface EtecsaRegisterPayload {
  docType: number;
  document: string;
  entity: string;
  sectorialPlan: string;
}

export interface EtecsaRegisterResult {
  success: boolean;
  isHolder: boolean;
  error?: string;
}

/**
 * Analyze a student's status in ETECSA
 */
export async function analyzeStudent(
  document: string,
  docType: number
): Promise<EtecsaAnalyzeResponse | null> {
  try {
    const url = `${ETECSA_BASE_URL}/special-segments/v1/mes/analyze?document=${document}&document_type=${docType}&subsegment=${SECTORIAL_PLAN_CODE}`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Register a student in ETECSA
 * Returns success=true if registered (is holder), success=false if rejected
 */
export async function registerStudent(
  payload: EtecsaRegisterPayload
): Promise<EtecsaRegisterResult> {
  try {
    const url = `${ETECSA_BASE_URL}/special-segments/v1/mes/register`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, sectorialPlan: SECTORIAL_PLAN_CODE }),
      cache: "no-store",
    });

    if (res.status === 200 || res.status === 201) {
      return { success: true, isHolder: true };
    }

    if (res.status === 422) {
      // Validation error - bad data
      return { success: false, isHolder: false, error: "error" };
    }

    if (res.status === 409 || res.status === 404) {
      // Not a holder
      return { success: false, isHolder: false, error: "no_holder" };
    }

    return { success: false, isHolder: false, error: "unknown" };
  } catch (err) {
    return {
      success: false,
      isHolder: false,
      error: err instanceof Error ? err.message : "network_error",
    };
  }
}
