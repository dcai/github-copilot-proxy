import PageLayout from "./PageLayout";

export function ModelsPage() {
  const header = "Copilot Models";

  return (
    <PageLayout title={header} currentPage="models">
      <header class="page-heading">
        <div>
          <p class="eyebrow">Live catalog</p>
          <h1>{header}</h1>
          <p class="page-description">
            Available models grouped by family. Expand a row to inspect its full
            API response.
          </p>
        </div>
      </header>
      <div id="status" class="status" aria-live="polite">
        Loading models...
      </div>
      <div id="models"></div>
      <script type="module" src="/static/models-page.js"></script>
    </PageLayout>
  );
}

export default ModelsPage;
