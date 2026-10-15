// Human labels for the enum-like text columns. The database doesn't constrain these,
// so every lookup falls back to the raw string instead of failing.

export const ROLE_LABELS: Record<string, string> = {
  software_engineering: "Software engineering",
  web_development: "Web development",
  mobile_development: "Mobile development",
  data_ml_ai: "Data, ML & AI",
  devops_it: "DevOps & IT",
  qa_testing: "QA & testing",
  game_development: "Game development",
  design: "Design",
  art_illustration: "Art & illustration",
  video_animation: "Video & animation",
  audio_music_voice: "Audio, music & voice",
  writing_content: "Writing & content",
  marketing_seo: "Marketing & SEO",
  sales_business_development: "Sales & business development",
  virtual_assistant_admin: "Virtual assistant & admin",
  customer_support: "Customer support",
  finance_accounting: "Finance & accounting",
  education_tutoring: "Education & tutoring",
  other: "Other",
};

export const SENIORITY_LABELS: Record<string, string> = {
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  lead: "Lead",
};

export const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  freelance_project: "Freelance project",
  internship: "Internship",
};

export const PAY_TYPE_LABELS: Record<string, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  fixed_project: "Fixed price",
  per_unit: "Per piece",
  commission_only: "Commission only",
  equity_or_revenue_share: "Equity / revenue share",
};

export const WORK_MODE_LABELS: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

export const APPLY_METHOD_LABELS: Record<string, string> = {
  reddit_dm: "Message the poster on Reddit",
  reddit_comment: "Comment on the Reddit post",
  email: "By email (address in the post)",
  external_link: "Through a link in the post",
  other: "See the post for details",
};

/** Label for a known value, the raw string for an unknown one, null for null. */
export function labelFor(map: Record<string, string>, value: string | null): string | null {
  if (value == null || value === "") return null;
  return Object.hasOwn(map, value) ? map[value] : value;
}

/** Display order for filter options: known values in map order, unknown values after, A–Z. */
export function orderedKeys(map: Record<string, string>, present: Iterable<string>): string[] {
  const known = Object.keys(map);
  const extra = [...new Set(present)].filter((v) => !Object.hasOwn(map, v)).sort();
  return [...known, ...extra];
}
