export const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const pluralize = (count, noun) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

export async function loadModels() {
  const response = await fetch("/models");

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return {
    models: Array.isArray(payload?.data) ? payload.data : [],
    payload,
  };
}
