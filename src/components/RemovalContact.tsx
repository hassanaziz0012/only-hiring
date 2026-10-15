import { removalEmail, SOURCE_URL } from "@/lib/site";

/**
 * "Email … with the link to the post." Falls back to the repo's issue tracker when
 * REMOVAL_EMAIL is unset, and renders nothing when neither is available.
 */
export function RemovalContact({ lead, className = "mt-2" }: { lead: string; className?: string }) {
  const email = removalEmail();
  if (email) {
    return (
      <p className={className}>
        {lead} Email{" "}
        <a className="link font-bold" href={`mailto:${email}?subject=Removal%20request`}>
          {email}
        </a>{" "}
        with the link to the post.
      </p>
    );
  }
  if (SOURCE_URL) {
    return (
      <p className={className}>
        {lead}{" "}
        <a className="link font-bold" href={`${SOURCE_URL}/issues/new`}>
          Open an issue
        </a>{" "}
        with the link to the post.
      </p>
    );
  }
  return null;
}

/** Whether RemovalContact has anything to show, so callers can drop the whole section. */
export function hasRemovalContact(): boolean {
  return Boolean(removalEmail() || SOURCE_URL);
}
