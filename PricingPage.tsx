import Nav from "./nav";

export function PricingPage() {
  const header = "Model Pricing";

  return (
    <html lang="en">
      <head>
        <title>{header}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/static/styles.css" />
      </head>
      <body class="pricing-page">
        <Nav />
        <main>
          <div class="page-heading">
            <div>
              <p class="eyebrow">GitHub Copilot model catalog</p>
              <h1>{header}</h1>
              <p class="page-description">
                Live prices from the Copilot API, shown as AI credits per 1M
                tokens.
              </p>
            </div>
            <a class="raw-link" href="/models">
              View raw model data
            </a>
          </div>
          <div class="pricing-toolbar">
            <label>
              <span>Search</span>
              <input
                id="pricing-search"
                type="search"
                placeholder="Search models or providers"
              />
            </label>
            <label>
              <span>Provider</span>
              <select id="pricing-provider">
                <option value="">All providers</option>
              </select>
            </label>
            <label>
              <span>Sort by</span>
              <select id="pricing-sort">
                <option value="name">Name</option>
                <option value="input">Input cost</option>
                <option value="output">Output cost</option>
                <option value="cache-read">Cache read cost</option>
                <option value="cache-write">Cache write cost</option>
              </select>
            </label>
            <label>
              <span>Order</span>
              <select id="pricing-order">
                <option value="asc">Low to high</option>
                <option value="desc">High to low</option>
              </select>
            </label>
          </div>
          <div id="pricing-status" class="status">
            Loading pricing...
          </div>
          <div id="pricing-summary" class="pricing-summary"></div>
          <div class="pricing-table-wrap">
            <table class="pricing-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Context size</th>
                  <th>Capabilities</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Cache read</th>
                  <th>Cache write</th>
                </tr>
              </thead>
              <tbody id="pricing-models"></tbody>
            </table>
          </div>
        </main>
        <script src="/static/pricing-page.js"></script>
      </body>
    </html>
  );
}

export default PricingPage;
