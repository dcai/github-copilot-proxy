import type { FC, PropsWithChildren } from "hono/jsx";
import Nav, { type Page } from "./nav";

type PageLayoutProps = {
  title: string;
  currentPage: Page;
};

export const PageLayout: FC<PropsWithChildren<PageLayoutProps>> = ({
  title,
  currentPage,
  children,
}) => {
  return (
    <html lang="en">
      <head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/static/styles.css" />
      </head>
      <body>
        <Nav currentPage={currentPage} />
        <main class="page-content">{children}</main>
      </body>
    </html>
  );
};

export default PageLayout;
