export type Page = "usage" | "models" | "pricing";

type NavProps = {
  currentPage: Page;
};

const navigationItems: Array<{ href: string; label: string; page: Page }> = [
  { href: "/", label: "Usage", page: "usage" },
  { href: "/models.html", label: "Models", page: "models" },
  { href: "/pricing.html", label: "Pricing", page: "pricing" },
];

export function Nav({ currentPage }: NavProps) {
  return (
    <nav class="top-nav">
      <a class="brand" href="/">
        Copilot Proxy
      </a>
      <div class="nav-links">
        {navigationItems.map((item) => (
          <a
            href={item.href}
            class={item.page === currentPage ? "active" : undefined}
            aria-current={item.page === currentPage ? "page" : undefined}
          >
            {item.label}
          </a>
        ))}
        <a href="/models">Raw JSON</a>
      </div>
    </nav>
  );
}

export default Nav;
