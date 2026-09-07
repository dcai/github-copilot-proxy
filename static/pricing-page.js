import { escapeHtml, loadModels, pluralize } from "./ui.js";

const searchNode = document.getElementById("pricing-search");
const providerNode = document.getElementById("pricing-provider");
const sortNode = document.getElementById("pricing-sort");
const orderNode = document.getElementById("pricing-order");
const statusNode = document.getElementById("pricing-status");
const summaryNode = document.getElementById("pricing-summary");
const modelsNode = document.getElementById("pricing-models");

let models = [];

const getPrices = (model) => model?.billing?.token_prices;

const getDefaultTier = (model) => getPrices(model)?.default;

const getLongContextTier = (model) => getPrices(model)?.long_context;

const getBatchSize = (model) => {
  const batchSize = Number(getPrices(model)?.batch_size);
  return Number.isFinite(batchSize) && batchSize > 0 ? batchSize : null;
};

const getCreditPrice = (model, tier, field) => {
  const batchSize = getBatchSize(model);
  const value = Number(tier?.[field]);

  if (batchSize === null || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value * (1_000_000 / batchSize);
};

const formatNumber = (value) => {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
};

const formatTokenCount = (value) => {
  const count = Number(value);

  if (!Number.isFinite(count) || count <= 0) {
    return "-";
  }

  if (count >= 1_000_000) {
    return `${formatNumber(count / 1_000_000)}M`;
  }

  if (count >= 1_000) {
    return `${formatNumber(count / 1_000)}K`;
  }

  return formatNumber(count);
};

const getModelName = (model) =>
  String(model?.name || model?.id || "Unknown model");

const getProvider = (model) => String(model?.vendor || "Unknown provider");

const getSortValue = (model, field) => {
  if (field === "name") {
    return getModelName(model).toLowerCase();
  }

  const fieldMap = {
    input: "input_price",
    output: "output_price",
    "cache-read": "cache_read_price",
    "cache-write": "cache_write_price",
  };
  const value = getCreditPrice(model, getDefaultTier(model), fieldMap[field]);
  return value === null ? Number.POSITIVE_INFINITY : value;
};

const compareModels = (left, right) => {
  const field = sortNode.value;
  const leftValue = getSortValue(left, field);
  const rightValue = getSortValue(right, field);
  const direction = orderNode.value === "desc" ? -1 : 1;
  const leftMissing = leftValue === Number.POSITIVE_INFINITY;
  const rightMissing = rightValue === Number.POSITIVE_INFINITY;

  if (leftMissing !== rightMissing) {
    return leftMissing ? 1 : -1;
  }

  if (typeof leftValue === "string" && typeof rightValue === "string") {
    return (
      leftValue.localeCompare(rightValue, undefined, {
        numeric: true,
        sensitivity: "base",
      }) * direction
    );
  }

  if (leftValue === rightValue) {
    return getModelName(left).localeCompare(getModelName(right), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  return (leftValue - rightValue) * direction;
};

const hasLongContextPricing = (model) => {
  const defaultTier = getDefaultTier(model);
  const longTier = getLongContextTier(model);

  if (!longTier) {
    return false;
  }

  return [
    "input_price",
    "output_price",
    "cache_read_price",
    "cache_write_price",
  ].some(
    (field) =>
      getCreditPrice(model, defaultTier, field) !==
      getCreditPrice(model, longTier, field),
  );
};

const renderTierValue = (model, tier, field, label) => {
  const value = getCreditPrice(model, tier, field);
  const contextLabel = label ? `<span class="price-tier">${label}</span>` : "";

  return `<span class="price-line">${contextLabel}<strong>${formatNumber(value)}</strong></span>`;
};

const renderPriceCell = (model, field) => {
  const defaultTier = getDefaultTier(model);
  const longTier = getLongContextTier(model);
  const longContext = hasLongContextPricing(model);

  if (!defaultTier || getBatchSize(model) === null) {
    return '<span class="price-unavailable">Not published</span>';
  }

  const defaultValue = renderTierValue(
    model,
    defaultTier,
    field,
    longContext ? "Default" : "",
  );
  const longValue = longContext
    ? renderTierValue(model, longTier, field, "Long")
    : "";

  return `<div class="price-values">${defaultValue}${longValue}</div>`;
};

const renderCacheWriteCell = (model) => {
  const defaultTier = getDefaultTier(model);
  const longTier = getLongContextTier(model);
  const batchSize = getBatchSize(model);

  if (!defaultTier || batchSize === null) {
    return '<span class="price-unavailable">Not published</span>';
  }

  const renderCacheWrite = (tier, label) => {
    const standard = renderTierValue(model, tier, "cache_write_price", label);
    const oneHour = getCreditPrice(model, tier, "cache_write_1h_price");

    if (oneHour === null) {
      return standard;
    }

    return `${standard}<span class="price-line price-subline"><span class="price-tier">1h</span><strong>${formatNumber(oneHour)}</strong></span>`;
  };

  const longContext = hasLongContextPricing(model);
  return `<div class="price-values">${renderCacheWrite(
    defaultTier,
    longContext ? "Default" : "",
  )}${longContext ? renderCacheWrite(longTier, "Long") : ""}</div>`;
};

const renderCapabilities = (model) => {
  const supports = model?.capabilities?.supports || {};
  const capabilities = [];

  if (supports.tool_calls) {
    capabilities.push("Tools");
  }
  if (supports.vision) {
    capabilities.push("Vision");
  }
  if (supports.streaming) {
    capabilities.push("Streaming");
  }

  if (capabilities.length === 0) {
    return '<span class="muted">-</span>';
  }

  return capabilities
    .map((capability) => `<span class="capability">${capability}</span>`)
    .join("");
};

const renderModelRow = (model) => {
  const category = model?.model_picker_price_category
    ? `<span class="category category-${escapeHtml(
        model.model_picker_price_category,
      )}">${escapeHtml(model.model_picker_price_category)}</span>`
    : "";
  const modelId = model?.id ? `<code>${escapeHtml(model.id)}</code>` : "";
  const contextSize = formatTokenCount(
    model?.capabilities?.limits?.max_context_window_tokens,
  );

  return `
    <tr>
      <td>
        <div class="model-name">${escapeHtml(getModelName(model))}</div>
        <div class="model-meta">${escapeHtml(getProvider(model))} ${modelId}</div>
        ${category}
      </td>
      <td>${contextSize}</td>
      <td><div class="capabilities">${renderCapabilities(model)}</div></td>
      <td>${renderPriceCell(model, "input_price")}</td>
      <td>${renderPriceCell(model, "output_price")}</td>
      <td>${renderPriceCell(model, "cache_read_price")}</td>
      <td>${renderCacheWriteCell(model)}</td>
    </tr>
  `;
};

const getFilteredModels = () => {
  const search = searchNode.value.trim().toLowerCase();
  const provider = providerNode.value;

  return models
    .filter((model) => {
      const searchText = [
        getModelName(model),
        model?.id,
        getProvider(model),
        model?.model_picker_category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!search || searchText.includes(search)) &&
        (!provider || getProvider(model) === provider)
      );
    })
    .sort(compareModels);
};

const render = () => {
  const visibleModels = getFilteredModels();
  const pricedModels = visibleModels.filter(
    (model) => getBatchSize(model) !== null,
  ).length;

  summaryNode.innerHTML = `
    <span><strong>${visibleModels.length}</strong> model${visibleModels.length === 1 ? "" : "s"}</span>
    <span><strong>${pricedModels}</strong> with published token rates</span>
    <span>Values are AI credits per 1M tokens</span>
  `;

  modelsNode.innerHTML =
    visibleModels.length > 0
      ? visibleModels.map(renderModelRow).join("")
      : '<tr><td colspan="7" class="empty-state">No models match the current filters.</td></tr>';
};

const populateProviders = () => {
  const providers = [...new Set(models.map(getProvider))].sort((left, right) =>
    left.localeCompare(right),
  );

  providerNode.innerHTML =
    '<option value="">All providers</option>' +
    providers
      .map(
        (provider) =>
          `<option value="${escapeHtml(provider)}">${escapeHtml(provider)}</option>`,
      )
      .join("");
};

[searchNode, providerNode, sortNode, orderNode].forEach((node) => {
  node.addEventListener("input", render);
  node.addEventListener("change", render);
});

async function initialisePricing() {
  try {
    const loaded = await loadModels();
    models = loaded.models;
    populateProviders();
    statusNode.textContent = `Updated from the live Copilot model catalog: ${pluralize(models.length, "model")}.`;
    render();
  } catch (error) {
    statusNode.textContent = "Failed to load pricing.";
    statusNode.classList.add("error");
    summaryNode.textContent = "";
    modelsNode.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(
      error.message || String(error),
    )}</td></tr>`;
  }
}

initialisePricing();
