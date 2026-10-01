"""Build invisible discovery metadata from the two project's existing abstracts.

The visible paper copy remains in each index.html; this script keeps JSON-LD and
agent-readable Markdown aligned with it. Requires lxml.
"""

from pathlib import Path
from html import escape
import json
import re

from lxml import html


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://chenkangjie1123.github.io"

PROJECTS = [
    {
        "directory": "Co-Adaptation-3DGS",
        "title": "Quantifying and Alleviating Co-Adaptation in Sparse-View 3D Gaussian Splatting",
        "summary": "Studies color artifacts caused by co-adapted Gaussians in sparse-view 3DGS, introduces a Co-Adaptation Score, and evaluates Gaussian dropout and opacity noise to improve novel-view rendering.",
        "authors": ["Kangjie Chen", "Yingji Zhong", "Zhihao Li", "Jiaqi Lin", "Youyu Chen", "Minghan Qin", "Haoqian Wang"],
        "conference": "NeurIPS 2025",
        "published": "2025-08-18",
        "arxiv": "2508.12720",
        "code": "https://github.com/chenkangjie1123/Co-Adaptation-of-3DGS/",
        "image": "teaser.png",
        "abstract_xpath": "//section[contains(concat(' ', normalize-space(@class), ' '), ' abstract ')]/p[1]",
        "keywords": ["sparse-view 3D Gaussian Splatting", "novel view synthesis", "co-adaptation", "Gaussian dropout", "opacity noise injection"],
    },
    {
        "directory": "SLGaussian",
        "title": "SLGaussian: Fast Language Gaussian Splatting in Sparse Views",
        "summary": "Builds 3D semantic fields from two RGB views without per-scene optimization and supports fast open-vocabulary 3D object querying and segmentation.",
        "authors": ["Kangjie Chen", "BingQuan Dai", "Minghan Qin", "Dongbin Zhang", "Peihao Li", "Yingshuang Zou", "Haoqian Wang"],
        "conference": "ACM Multimedia 2025",
        "published": "2024-12-11",
        "arxiv": "2412.08331",
        "code": "https://github.com/chenkangjie1123/SLGaussian",
        "image": "static/images/teaser.png",
        "abstract_xpath": "//h2[normalize-space(.)='Abstract']/following::p[1]",
        "keywords": ["language Gaussian splatting", "sparse views", "3D semantic field", "open-vocabulary 3D segmentation", "3D object localization"],
    },
]


def metadata(config, abstract):
    url = f"{ORIGIN}/{config['directory']}/"
    arxiv = f"https://arxiv.org/abs/{config['arxiv']}"
    doi = f"https://doi.org/10.48550/arXiv.{config['arxiv']}"
    image = f"{url}{config['image']}"
    attributes = [
        ("link", "rel", "canonical", "href", url),
        ("link", "rel", "alternate", "type", "text/markdown", "href", "./index.md"),
        ("link", "rel", "describedby", "type", "text/plain", "href", "./llms.txt"),
        ("meta", "name", "robots", "content", "index, follow, max-image-preview:large"),
        ("meta", "name", "citation_title", "content", config["title"]),
        *(("meta", "name", "citation_author", "content", author) for author in config["authors"]),
        ("meta", "name", "citation_publication_date", "content", config["published"].replace("-", "/")),
        ("meta", "name", "citation_conference_title", "content", config["conference"]),
        ("meta", "name", "citation_doi", "content", f"10.48550/arXiv.{config['arxiv']}"),
        ("meta", "name", "citation_abstract_html_url", "content", url),
        ("meta", "property", "og:type", "content", "article"),
        ("meta", "property", "og:title", "content", config["title"]),
        ("meta", "property", "og:description", "content", config["summary"]),
        ("meta", "property", "og:url", "content", url),
        ("meta", "property", "og:image", "content", image),
        ("meta", "property", "og:image:alt", "content", config["title"]),
        ("meta", "name", "twitter:card", "content", "summary_large_image"),
        ("meta", "name", "twitter:title", "content", config["title"]),
        ("meta", "name", "twitter:description", "content", config["summary"]),
        ("meta", "name", "twitter:image", "content", image),
    ]
    lines = []
    for tag, *pairs in attributes:
        pairs = list(zip(pairs[::2], pairs[1::2]))
        lines.append("    <" + tag + " " + " ".join(f'{key}="{escape(value, quote=True)}"' for key, value in pairs) + ">")
    schema = {
        "@context": "https://schema.org",
        "@type": "ScholarlyArticle",
        "headline": config["title"],
        "abstract": abstract,
        "description": config["summary"],
        "author": [{"@type": "Person", "name": name} for name in config["authors"]],
        "datePublished": config["published"],
        "inLanguage": "en",
        "url": url,
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "sameAs": [arxiv, doi],
        "identifier": {"@type": "PropertyValue", "propertyID": "arXiv", "value": config["arxiv"]},
        "image": image,
        "keywords": config["keywords"],
        "isAccessibleForFree": True,
    }
    lines.append('    <script type="application/ld+json">')
    lines.extend("    " + line for line in json.dumps(schema, ensure_ascii=False, indent=2).replace("</", "<\\/").splitlines())
    lines.append("    </script>")
    return "<!-- discovery metadata start -->\n" + "\n".join(lines) + "\n    <!-- discovery metadata end -->"


def update_project(config):
    folder = ROOT / config["directory"]
    page = folder / "index.html"
    source = page.read_text()
    tree = html.fromstring(source)
    nodes = tree.xpath(config["abstract_xpath"])
    if len(nodes) != 1:
        raise ValueError(f"Expected one abstract in {page}")
    abstract = " ".join(nodes[0].text_content().split())
    block = metadata(config, abstract)
    if "<!-- discovery metadata start -->" in source:
        source = re.sub(r"<!-- discovery metadata start -->.*?<!-- discovery metadata end -->", block, source, flags=re.S)
    else:
        source = source.replace("</title>", "</title>\n    " + block, 1)
    # Keep a concise description in the head. The complete author abstract remains untouched.
    source = re.sub(r'<meta name="description"\s+content="[^"]*">',
                    f'<meta name="description" content="{escape(config["summary"], quote=True)}">', source, count=1)
    page.write_text(source)

    canonical = f"{ORIGIN}/{config['directory']}/"
    markdown = f"# {config['title']}\n\n> {config['summary']}\n\n" \
        f"Venue: {config['conference']}. First posted to arXiv: {config['published']}.\n\n" \
        f"Authors: {', '.join(config['authors'])}.\n\n## Abstract\n\n{abstract}\n\n" \
        f"## Sources\n\n- [Project page]({canonical})\n" \
        f"- [Paper on arXiv](https://arxiv.org/abs/{config['arxiv']})\n" \
        f"- [Source code]({config['code']})\n"
    (folder / "index.md").write_text(markdown)
    llms = f"# {config['title']}\n\n> {config['summary']}\n\n" \
        f"## Paper and project\n\n- [Research summary]({canonical}index.md): Author-written abstract, authors, venue, and source links.\n" \
        f"- [Project page]({canonical}): Original figures, results, and BibTeX.\n" \
        f"- [arXiv paper](https://arxiv.org/abs/{config['arxiv']}): Full research paper.\n" \
        f"- [Code]({config['code']}): Project repository.\n"
    (folder / "llms.txt").write_text(llms)


if __name__ == "__main__":
    for project in PROJECTS:
        update_project(project)
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {ORIGIN}/sitemap.xml\n")
    (ROOT / "sitemap.xml").write_text('''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://chenkangjie1123.github.io/Co-Adaptation-3DGS/</loc></url>
  <url><loc>https://chenkangjie1123.github.io/SLGaussian/</loc></url>
  <url><loc>https://chenkangjie1123.github.io/VGGT-Diff/</loc></url>
</urlset>
''')
    (ROOT / "llms.txt").write_text('''# Kangjie Chen research projects

> Research project pages on 3D Gaussian splatting, sparse-view novel-view synthesis, and language-aware 3D scene understanding.

## Project pages

- [Co-Adaptation of 3DGS](https://chenkangjie1123.github.io/Co-Adaptation-3DGS/index.md): Quantifying and alleviating co-adaptation in sparse-view 3D Gaussian Splatting; NeurIPS 2025.
- [SLGaussian](https://chenkangjie1123.github.io/SLGaussian/index.md): Fast language Gaussian Splatting in sparse views; ACM Multimedia 2025.

## Optional

- [VGGT-Diff](https://chenkangjie1123.github.io/VGGT-Diff/): Another project page on this site.
''')
