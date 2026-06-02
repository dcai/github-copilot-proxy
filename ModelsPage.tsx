import Nav from "./nav";

export function ModelsPage() {
  const header = "Copilot Models";

  return (
    <html lang="en">
      <head>
        <title>{header}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/static/styles.css" />
      </head>
      <body class="models-page">
        <Nav />
        <h1>{header}</h1>
        <div id="status" class="status">
          Loading models...
        </div>
        <div id="models"></div>
        <script src="/static/models-page.js"></script>
      </body>
    </html>
  );
}

export default ModelsPage;
