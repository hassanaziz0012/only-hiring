import { ImageResponse } from "next/og";
import { getJob, getJobs } from "@/lib/db";
import { formatPay } from "@/lib/format";
import { scamWarningLabel } from "@/lib/jobs";
import { labelFor, WORK_MODE_LABELS } from "@/lib/labels";
import { clip, drawable, OG_COLORS, OG_FONTS, OG_SIZE, OgWordmark } from "@/lib/og";

export const alt = "The job's title, pay and subreddit";
export const size = OG_SIZE;
export const contentType = "image/png";

// Built with the job pages. Jobs added after a deploy render on first request, and the CDN keeps them.
export async function generateStaticParams() {
  const result = await getJobs();
  if (!result.ok || result.jobs.length === 0) return [{ id: "_" }];
  return result.jobs.map((job) => ({ id: job.id }));
}

const CDN_CACHE = { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" };

/** Long titles get a smaller size, so up to three lines fit between the header and the pay. */
function titleSize(title: string): number {
  if (title.length <= 28) return 104;
  if (title.length <= 50) return 84;
  return 66;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getJob(id);
  if (!result.ok || !result.job) return new Response("Not found", { status: 404 });
  const job = result.job;
  const title = clip(drawable(job.jobTitle), 80);
  const pay = formatPay(job);
  const payText = drawable(pay.text, job.payCurrency);
  const warning = scamWarningLabel(job);
  const mode = labelFor(WORK_MODE_LABELS, job.workMode);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OG_COLORS.mint,
          color: OG_COLORS.ink,
          padding: "64px 80px",
          fontFamily: "Pilcrow",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <OgWordmark size={52} />
          <span style={{ fontSize: 40, letterSpacing: "-0.02em" }}>r/{job.subreddit}</span>
        </div>
        <div style={{ display: "flex", fontSize: titleSize(title), lineHeight: 1, letterSpacing: "-0.04em" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 44, letterSpacing: "-0.02em" }}>
          <span style={{ opacity: pay.stated ? 1 : 0.6 }}>{payText}</span>
          {mode && <span style={{ opacity: 0.6 }}>· {mode}</span>}
          {warning && (
            <span style={{ marginLeft: "auto", background: OG_COLORS.pink, padding: "8px 20px", fontSize: 36 }}>{warning}</span>
          )}
        </div>
      </div>
    ),
    { ...size, fonts: OG_FONTS, headers: CDN_CACHE },
  );
}
