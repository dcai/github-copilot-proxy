import type { CopilotUsageResponse, CopilotQuotaSnapshot } from "./types";

import { css, cx, keyframes, Style } from "hono/css";

const BLUE = "#3498db";
const GREEN = "#568203";
const RED = "#e74c3c";

function ProgressBar({
  unlimited,
  percent,
}: { percent: number; unlimited?: boolean }) {
  const centerStyle = {
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const outerStyle = {
    width: "100%",
    background: unlimited ? BLUE : "#eee",
    borderRadius: "8px",
    height: "24px",
    marginBottom: "8px",
    ...(unlimited && centerStyle),
  };
  return (
    <div style={outerStyle}>
      {unlimited ? (
        "Unlimited"
      ) : (
        <div
          style={{
            width: `${percent}%`,
            background: percent > 90 ? RED : GREEN,
            height: "100%",
            borderRadius: "8px",
            transition: "width 0.3s",
            ...centerStyle,
          }}
        >
          {unlimited ? "" : `${percent.toFixed(2)}% used`}
        </div>
      )}
    </div>
  );
}

function UsageDetails({
  quota,
  label,
  quotaResetDate,
}: { quota: CopilotQuotaSnapshot; label: string; quotaResetDate?: string }) {
  return (
    <section style={{ marginBottom: "24px" }}>
      <h2>{label}</h2>
      <ProgressBar
        unlimited={quota.unlimited}
        percent={100 - quota.percent_remaining}
      />
      <ul>
        <li>
          Used: <strong>{(100 - quota.percent_remaining)?.toFixed(2)}%</strong>
        </li>
        <li>
          Entitlement:{" "}
          {quota.unlimited ? "Unlimited" : String(quota.entitlement)}
        </li>
        <li>Remaining: {quota.remaining}</li>
        <li>Last Updated: {new Date(quota.timestamp_utc).toLocaleString()}</li>
        {quotaResetDate && (
          <li>Quota resets: {new Date(quotaResetDate).toLocaleString()}</li>
        )}
      </ul>
    </section>
  );
}

export function UsagePage({ usage }: { usage: CopilotUsageResponse }) {
  const chat = usage.quota_snapshots.chat;
  const premium = usage.quota_snapshots.premium_interactions;
  const completions = usage.quota_snapshots.completions;

  const header = "Copilot Usage Details";

  return (
    <html>
      <head>
        <title>{header}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Style>{css`
          body { font-family: monospace; max-width: 600px; margin: 40px auto; background: #fafafa; color: #222; }
          h1 { text-align: center; }
          section { background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; padding: 16px; margin-bottom: 24px; }
          ul { list-style: none; padding: 0; }
          li { margin-bottom: 4px; }
          footer { text-align: left; padding: 1em; background: #fff; color: #888; margin-top: 32px; }
          code {margin-top: 2em;display: block; padding: 1em; background: #fff; color: ${GREEN}; }
        `}</Style>
      </head>
      <body>
        <h1>{header}</h1>
        <UsageDetails
          quota={premium}
          label="Premium Requests"
          quotaResetDate={usage.quota_reset_date}
        />
        <UsageDetails quota={chat} label="Chat" />
        <UsageDetails quota={completions} label="Completions" />
        <footer>
          <div>Quota resets: {usage.quota_reset_date}</div>
          <div>Plan: {usage.copilot_plan}</div>
          {usage.organization_list?.length > 1 && (
            <div>Organizations: {usage.organization_list?.join(", ")}</div>
          )}
        </footer>
        <code>
          <pre>{JSON.stringify(usage, null, 2)}</pre>
        </code>
      </body>
    </html>
  );
}

export default UsagePage;
