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
  name: process.env.NEXT_PUBLIC_LOSTO_OPERATOR ?? "DoodleByte Studio",
  /** Where a person can reach a human about their data. */
  email: process.env.NEXT_PUBLIC_LOSTO_CONTACT ?? "doodlebyte.studio@gmail.com",
  /** Required by the DPDP Act for grievance redressal. */
  grievanceOfficer: process.env.NEXT_PUBLIC_LOSTO_GRIEVANCE ?? "doodlebyte.studio@gmail.com",
  jurisdiction: process.env.NEXT_PUBLIC_LOSTO_JURISDICTION ?? "Chennai, Tamil Nadu, India",
  effectiveDate: process.env.NEXT_PUBLIC_LOSTO_EFFECTIVE ?? "[date]",
  /** Response window promised for data requests. DPDP expects a stated period. */
  responseDays: 30,
} as const;

export const STUDIO = {
  name: "DoodleByte Studio",
  tagline: "We don’t just build software. We give it a soul.",
  site: "https://doodlebytestudio.in",
  email: "doodlebyte.studio@gmail.com",
  whatsapp: "+91 7358004687",
  city: "Chennai, India",
} as const;

/** The effective date is the one value that must still be set per release. */
export const isConfigured = !OPERATOR.effectiveDate.startsWith("[");
