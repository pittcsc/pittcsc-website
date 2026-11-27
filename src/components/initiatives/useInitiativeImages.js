import { useMemo } from "react";
import { graphql, useStaticQuery } from "gatsby";
import { getImage } from "gatsby-plugin-image";

function normalizeRelativePath(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^\/+/, "")
    .replace(/^src\/images\//, "");
}

function extractBaseName(value) {
  if (typeof value !== "string") return "";
  const cleaned = value.split(/[?#]/)[0];
  const fileName = cleaned.slice(cleaned.lastIndexOf("/") + 1);
  if (!fileName) return "";
  // Strip Gatsby/Webpack content hash suffixes such as "-a1b2c3d4e5f6..."
  return fileName.replace(/-[0-9a-f]{16,}(\.[^.]+)$/i, "$1").toLowerCase();
}

export function useInitiativeImages() {
  const data = useStaticQuery(graphql`
    query AllInitiativeImagesQuery {
      allFile(
        filter: {
          sourceInstanceName: { eq: "images" }
          relativeDirectory: { regex: "/^initiatives(?!\\/offer-plus)/" }
        }
      ) {
        nodes {
          relativePath
          name
          ext
          childImageSharp {
            cardImage: gatsbyImageData(
              width: 640
              aspectRatio: 1.7778
              breakpoints: [320, 480, 640]
              sizes: "(min-width: 1024px) 360px, (min-width: 640px) 48vw, 96vw"
              transformOptions: { cropFocus: ATTENTION }
              placeholder: BLURRED
              formats: [AUTO, WEBP]
              quality: 76
            )
            featureImage: gatsbyImageData(
              width: 1200
              layout: CONSTRAINED
              breakpoints: [480, 768, 1200]
              sizes: "(min-width: 1024px) 740px, 96vw"
              placeholder: BLURRED
              formats: [AUTO, WEBP]
              quality: 80
            )
            galleryImage: gatsbyImageData(
              width: 640
              layout: CONSTRAINED
              breakpoints: [320, 480, 640]
              sizes: "(min-width: 1024px) 360px, (min-width: 640px) 48vw, 96vw"
              placeholder: BLURRED
              formats: [AUTO, WEBP]
              quality: 76
            )
          }
        }
      }
    }
  `);

  return useMemo(() => {
    const byPath = new Map();
    const byBase = new Map();

    const nodes = data?.allFile?.nodes || [];
    for (const node of nodes) {
      if (!node?.childImageSharp) continue;
      const entry = {
        relativePath: node.relativePath,
        cardImage: getImage(node.childImageSharp.cardImage),
        featureImage: getImage(node.childImageSharp.featureImage),
        galleryImage: getImage(node.childImageSharp.galleryImage),
      };

      const normalized = normalizeRelativePath(node.relativePath);
      byPath.set(normalized, entry);
      byPath.set(normalized.toLowerCase(), entry);

      const baseKey = `${node.name}${node.ext}`.toLowerCase();
      if (!byBase.has(baseKey)) {
        byBase.set(baseKey, entry);
      }
    }

    const resolve = (imageRef) => {
      if (!imageRef || typeof imageRef !== "string") return null;
      const normalized = normalizeRelativePath(imageRef);
      if (byPath.has(normalized)) return byPath.get(normalized);
      if (byPath.has(normalized.toLowerCase())) {
        return byPath.get(normalized.toLowerCase());
      }
      const baseKey = extractBaseName(imageRef);
      if (baseKey && byBase.has(baseKey)) {
        return byBase.get(baseKey);
      }
      return null;
    };

    return { byPath, byBase, resolve };
  }, [data]);
}
