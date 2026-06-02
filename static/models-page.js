const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const statusNode = document.getElementById("status");
const modelsNode = document.getElementById("models");

const groupOrder = [
  "GPT series",
  "Claude series",
  "Gemini series",
  "Embeddings",
  "Others",
];

const getModelKey = (model) => {
  return String(model.name || model.id || "").toLowerCase();
};

const getGroupName = (model) => {
  const key = getModelKey(model);
  if (key.includes("embedding")) return "Embeddings";
  if (key.includes("gpt")) return "GPT series";
  if (key.includes("claude")) return "Claude series";
  if (key.includes("gemini")) return "Gemini series";
  return "Others";
};

const renderModelRow = (model) => {
  const name = escapeHtml(model.name || model.id || "Unknown model");
  const version = model.version ? escapeHtml(model.version) : "";
  const modelId = model.id ? escapeHtml(model.id) : "";
  const rawJson = escapeHtml(JSON.stringify(model, null, 2));

  return (
    '<tr class="model-row">' +
    "<td>" +
    name +
    "</td>" +
    "<td>" +
    modelId +
    "</td>" +
    "<td>" +
    version +
    "</td>" +
    "<td>" +
    "<details><summary>Details</summary><pre>" +
    rawJson +
    "</pre></details>" +
    "</td>" +
    "</tr>"
  );
};

const compareModels = (leftModel, rightModel) => {
  const leftName = String(leftModel.name || leftModel.id || "").toLowerCase();
  const rightName = String(
    rightModel.name || rightModel.id || "",
  ).toLowerCase();
  return leftName.localeCompare(rightName, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const renderGroup = (groupName, models) => {
  const sortedModels = [...models].sort(compareModels);

  return (
    "<section>" +
    '<div class="group-header">' +
    "<h2>" +
    escapeHtml(groupName) +
    "</h2>" +
    '<span class="group-count">' +
    sortedModels.length +
    " model" +
    (sortedModels.length === 1 ? "" : "s") +
    "</span>" +
    "</div>" +
    '<table class="model-table">' +
    "<thead><tr><th>Name</th><th>ID</th><th>Version</th><th></th></tr></thead>" +
    "<tbody>" +
    sortedModels.map(renderModelRow).join("") +
    "</tbody>" +
    "</table>" +
    "</section>"
  );
};

const shouldHideModel = (model) => {
  const key = getModelKey(model);
  if (key.includes("4o")) return true;
  return false;
};

const groupModels = (models) => {
  const visibleModels = models.filter((model) => !shouldHideModel(model));
  const grouped = visibleModels.reduce((accumulator, model) => {
    const groupName = getGroupName(model);
    if (!accumulator[groupName]) {
      accumulator[groupName] = [];
    }
    accumulator[groupName] = accumulator[groupName].concat(model);
    return accumulator;
  }, {});

  return groupOrder
    .filter(
      (groupName) =>
        Array.isArray(grouped[groupName]) && grouped[groupName].length > 0,
    )
    .map((groupName) => renderGroup(groupName, grouped[groupName]))
    .join("");
};

fetch("/models")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Request failed with status " + response.status);
    }
    return response.json();
  })
  .then((payload) => {
    const models = Array.isArray(payload?.data) ? payload.data : [];
    statusNode.textContent =
      "Loaded " +
      models.length +
      " model" +
      (models.length === 1 ? "" : "s") +
      ".";
    if (models.length === 0) {
      modelsNode.innerHTML =
        "<p>No models found.</p><details><summary>Raw response</summary><pre>" +
        escapeHtml(JSON.stringify(payload, null, 2)) +
        "</pre></details>";
      return;
    }
    modelsNode.innerHTML = groupModels(models);
  })
  .catch((error) => {
    statusNode.textContent = "Failed to load models.";
    statusNode.classList.add("error");
    modelsNode.innerHTML =
      "<p>" + escapeHtml(error.message || String(error)) + "</p>";
  });
