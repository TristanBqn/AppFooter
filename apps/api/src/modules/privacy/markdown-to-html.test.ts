import { describe, expect, it } from "vitest";
import { renderPrivacyHtml } from "./markdown-to-html";

describe("renderPrivacyHtml", () => {
  it("convertit titres, paragraphes et gras", () => {
    const html = renderPrivacyHtml("# Titre\n\nUn **paragraphe** simple.\n\n## Section\n\nSuite.");
    expect(html).toBe(
      ["<h1>Titre</h1>", "<p>Un <strong>paragraphe</strong> simple.</p>", "<h2>Section</h2>", "<p>Suite.</p>"].join(
        "\n",
      ),
    );
  });

  it("convertit une liste à puces", () => {
    const html = renderPrivacyHtml("- Premier\n- Deuxième **important**");
    expect(html).toBe("<ul><li>Premier</li><li>Deuxième <strong>important</strong></li></ul>");
  });

  it("convertit une citation", () => {
    expect(renderPrivacyHtml("> Une note.")).toBe("<blockquote>Une note.</blockquote>");
  });

  it("convertit un tableau (ligne séparatrice ignorée)", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
    const html = renderPrivacyHtml(md);
    expect(html).toBe(
      "<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>",
    );
  });

  it("échappe les caractères HTML spéciaux", () => {
    expect(renderPrivacyHtml("Texte avec <balise> & esperluette.")).toBe(
      "<p>Texte avec &lt;balise&gt; &amp; esperluette.</p>",
    );
  });

  it("les lignes vides séparent les paragraphes ; une ligne blanche seule ne produit rien", () => {
    expect(renderPrivacyHtml("\n\n\n")).toBe("");
  });
});
