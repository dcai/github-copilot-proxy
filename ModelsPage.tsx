import { css, Style } from "hono/css";

const GREEN = "#568203";
const RED = "#e74c3c";

export function ModelsPage() {
  const header = "Copilot Models";

  return (
    <html lang="en">
      <head>
        <title>{header}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Style>{css`
          body { font-family: monospace; width: 100%; margin: 0; background: #fafafa; color: #222; box-sizing: border-box; }
          h1 { text-align: center; }
          p { line-height: 1.5; }
          .page { width: 100%; padding: 32px; box-sizing: border-box; }
          .status { margin-bottom: 16px; padding: 12px 16px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; }
          .status.error { color: ${RED}; }
          .models { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
          .card { background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; padding: 16px; }
          .meta { color: #666; margin-bottom: 8px; }
          .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #eef6ff; color: #2c5d87; margin-right: 8px; margin-bottom: 8px; }
          details { margin-top: 12px; }
          summary { cursor: pointer; color: ${GREEN}; }
          pre { overflow-x: auto; padding: 12px; background: #f5f5f5; border-radius: 8px; }
          footer { text-align: left; padding: 1em; background: #fff; color: #888; margin-top: 32px; border-radius: 8px; box-shadow: 0 2px 8px #0001; }
          a { color: ${GREEN}; }
          @media (max-width: 640px) {
            .page { padding: 16px; }
          }
        `}</Style>
      </head>
      <body>
        <div class="page">
          <h1>{header}</h1>
          <p>
            This page loads model data from <code>/models</code> and shows it in
            a readable format.
          </p>
          <div id="status" class="status">
            Loading models...
          </div>
          <div id="models" class="models"></div>
          <footer>
            <div>
              Raw JSON: <a href="/models">/models</a>
            </div>
            <div>
              Usage page: <a href="/">/</a>
            </div>
          </footer>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const statusNode = document.getElementById('status');
const modelsNode = document.getElementById('models');

const renderField = ([key, value]) => {
  if (key === 'capabilities') {
    return '<details><summary>Capabilities JSON</summary><pre>' + escapeHtml(JSON.stringify(value, null, 2)) + '</pre></details>';
  }

  return '<div><strong>' + escapeHtml(key) + ':</strong> ' + escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value) + '</div>';
};

const renderModel = (model) => {
  const entries = Object.entries(model).filter(([key]) => key !== 'id' && key !== 'name' && key !== 'version');
  const tags = [
    model.id ? '<span class="pill">id: ' + escapeHtml(model.id) + '</span>' : '',
    model.version ? '<span class="pill">version: ' + escapeHtml(model.version) + '</span>' : '',
  ].join('');
  const extraFields = entries.length > 0
    ? '<div class="meta">' + entries.map(renderField).join('') + '</div>'
    : '';

  return '<section class="card">'
    + '<h2>' + escapeHtml(model.name || model.id || 'Unknown model') + '</h2>'
    + '<div>' + tags + '</div>'
    + extraFields
    + '<details><summary>Raw model JSON</summary><pre>' + escapeHtml(JSON.stringify(model, null, 2)) + '</pre></details>'
    + '</section>';
};

fetch('/models')
  .then((response) => {
    if (!response.ok) {
      throw new Error('Request failed with status ' + response.status);
    }
    return response.json();
  })
  .then((payload) => {
    const models = Array.isArray(payload?.data) ? payload.data : [];
    statusNode.textContent = 'Loaded ' + models.length + ' model' + (models.length === 1 ? '' : 's') + '.';
    if (models.length === 0) {
      modelsNode.innerHTML = '<section class="card"><p>No models found.</p><details><summary>Raw response</summary><pre>' + escapeHtml(JSON.stringify(payload, null, 2)) + '</pre></details></section>';
      return;
    }
    modelsNode.innerHTML = models.map(renderModel).join('');
  })
  .catch((error) => {
    statusNode.textContent = 'Failed to load models.';
    statusNode.classList.add('error');
    modelsNode.innerHTML = '<section class="card"><pre>' + escapeHtml(error.message || String(error)) + '</pre></section>';
  });
            `,
          }}
        />
      </body>
    </html>
  );
}

export default ModelsPage;
