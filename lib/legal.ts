/**
 * Operator details used across the privacy notice and terms.
 *
 * IMPORTANT: the values below are placeholders. Before releasing publicly they
 * must be replaced with the real publisher, a working grievance contact, and a
 * reviewed effective date — the DPDP Act requires a named, reachable contact for
 * data-principal requests, and a policy naming nobody satisfies nothing.
 */
export const OPERATOR = {
  /** Individual or company publishing the app. */
  name: process.env.NEXT_PUBLIC_LOSTO_OPERATOR ?? "[Publisher name]",
  /** Where a person can reach a human about their data. */
  email: process.env.NEXT_PUBLIC_LOSTO_CONTACT ?? "[contact@example.com]",
  /** Required by the DPDP Act for grievance redressal. */
  grievanceOfficer: process.env.NEXT_PUBLIC_LOSTO_GRIEVANCE ?? "[Grievance Officer name]",
  jurisdiction: process.env.NEXT_PUBLIC_LOSTO_JURISDICTION ?? "India",
  effectiveDate: process.env.NEXT_PUBLIC_LOSTO_EFFECTIVE ?? "[date]",
  /** Response window promised for data requests. DPDP expects a stated period. */
  responseDays: 30,
} as const;

export const isConfigured = !OPERATOR.name.startsWith("[");
