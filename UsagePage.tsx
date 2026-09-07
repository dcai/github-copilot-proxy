import type {
  CopilotUsageResponse,
  CopilotQuotaSnapshot,
  Organization,
} from "./types";
import PageLayout from "./PageLayout";

function ProgressBar({
  unlimited,
  percent,
}: {
  percent: number;
  unlimited?: boolean;
}) {
  const percentage = `${percent.toFixed(2)}%`;
  const progressLabel = unlimited ? "Unlimited" : `${percentage}`;
  return (
    <div
      class={`progress-bar ${unlimited ? "is-unlimited" : ""}`}
      title={progressLabel}
      aria-label={progressLabel}
      role="progressbar"
      aria-valuenow={unlimited ? undefined : percent}
      aria-valuemin={unlimited ? undefined : 0}
      aria-valuemax={unlimited ? undefined : 100}
    >
      {unlimited ? (
        progressLabel
      ) : (
        <div
          class={`progress-value ${percent > 90 ? "is-critical" : ""}`}
          style={{
            width: `${percent}%`,
          }}
        >
          {progressLabel}
        </div>
      )}
    </div>
  );
}

function UsageDetails({
  quota,
  label,
  quotaResetDate,
}: {
  quota: CopilotQuotaSnapshot;
  label: string;
  quotaResetDate?: string;
}) {
  return (
    <section class="card usage-card">
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
    <PageLayout title={header} currentPage="usage">
      <header class="page-heading">
        <div>
          <p class="eyebrow">Account overview</p>
          <h1>{header}</h1>
          <p class="page-description">
            Current Copilot allowance and renewal information.
          </p>
        </div>
      </header>
      <div class="usage-grid">
        <UsageDetails
          quota={premium}
          label="Premium Requests"
          quotaResetDate={usage.quota_reset_date}
        />
        <UsageDetails quota={chat} label="Chat" />
        <UsageDetails quota={completions} label="Completions" />
      </div>
      <footer class="card usage-footer">
        <div>Quota resets: {usage.quota_reset_date}</div>
        <div>Plan: {usage.copilot_plan}</div>
        {usage.organization_list?.length > 0 && (
          <div>
            Organizations:{" "}
            {usage.organization_list
              ?.map((org: Organization) => org?.name)
              .join(", ")}
          </div>
        )}
      </footer>
      <details class="raw-data">
        <summary>View raw usage data</summary>
        <pre>{JSON.stringify(usage, null, 2)}</pre>
      </details>
    </PageLayout>
  );
}

export default UsagePage;
