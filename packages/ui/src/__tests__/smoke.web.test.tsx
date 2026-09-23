// Aperçu web (react-native-web) : les composants se rendent sans erreur et exposent leur accessibilité en ARIA.
// UI_GALLERY_OUT=<fichier.html> écrit la galerie en HTML autonome pour une capture Playwright.
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { AppRegistry } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Gallery } from "./Gallery";

function renderApp(withSheet = false) {
  AppRegistry.registerComponent("Gallery", () => () => <Gallery withSheet={withSheet} />);
  // API SSR de react-native-web (absente des types React Native).
  const app = (AppRegistry as unknown as {
    getApplication(key: string): { element: React.ReactElement; getStyleElement(): React.ReactElement };
  }).getApplication("Gallery");
  const html = renderToString(app.element);
  const css = renderToStaticMarkup(app.getStyleElement());
  return { html, css };
}

describe("rendu web", () => {
  const errors = vi.spyOn(console, "error");
  afterEach(() => errors.mockClear());

  it("rend toute la galerie sans erreur React", () => {
    const { html } = renderApp();
    expect(html).toContain("8 450");
    // Seul avertissement toléré : `collapsable` émis par le ScrollView de react-native-web lui-même.
    const ours = errors.mock.calls.filter((args) => !args.includes("collapsable"));
    expect(ours).toEqual([]);
  });

  it("expose les rôles et états ARIA", () => {
    const { html } = renderApp();
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="69"');
    expect(html).toContain('aria-valuetext="8 450 pas sur 10 000"');
    expect(html).toContain('aria-label="Période du classement"');
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"|aria-selected="true"[^>]*role="tab"/);
    expect(html).toContain('aria-label="2e ex æquo, tom, toi, 8 450 pas"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('role="heading"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("utilise une pile de polices de repli sur le web", () => {
    const { html } = renderApp();
    expect(html).toContain("font-family:ui-rounded");
    expect(html).toContain("font-family:-apple-system");
  });

  it("écrit la galerie si demandé", () => {
    const out = process.env.UI_GALLERY_OUT;
    if (!out) return;
    const { html, css } = renderApp(process.env.UI_GALLERY_SHEET === "1");
    writeFileSync(
      out,
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${css}<style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root" style="display:flex;height:100%">${html}</div></body></html>`,
    );
  });
});
