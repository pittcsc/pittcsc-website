import React, { useEffect, useMemo, useState } from "react";
import { Link } from "gatsby";
import { GatsbyImage } from "gatsby-plugin-image";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowUpRightFromSquare,
  faCheck,
  faEnvelope,
  faExpand,
} from "@fortawesome/free-solid-svg-icons";
import Layout from "../layouts/layout";
import { summarizeDescription } from "../lib/site/seo.mjs";
import { CLUB_SOCIALS } from "../lib/site/stats.mjs";
import { useInitiativeImages } from "./initiatives/useInitiativeImages";
import {
  findCatalogEntry,
  getRelatedInitiatives,
} from "./initiatives/initiativeCatalog";
import LightboxModal from "./initiatives/LightboxModal";

function isExternalHref(href, explicitExternal) {
  if (typeof explicitExternal === "boolean") return explicitExternal;
  return /^https?:\/\/|^mailto:/i.test(href || "");
}

function ActionLink({ item, variant = "primary", onDark = false }) {
  const external = isExternalHref(item.href, item.external);
  const baseClass =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  let colorClass;
  if (onDark) {
    colorClass =
      variant === "primary"
        ? "bg-secondary-100 text-primary hover:bg-yellow-400 focus-visible:outline-secondary-100"
        : "border border-white/25 bg-white/10 text-white hover:bg-white/20 focus-visible:outline-white";
  } else {
    colorClass =
      variant === "primary"
        ? "bg-primary text-white hover:bg-blue-900 shadow-sm focus-visible:outline-primary"
        : "border border-slate-300 bg-white text-slate-800 hover:border-primary hover:text-primary focus-visible:outline-primary";
  }

  const className = `${baseClass} ${colorClass}`;
  const content = (
    <>
      <span>{item.label}</span>
      {external && !/^mailto:/i.test(item.href || "") && (
        <FontAwesomeIcon
          icon={faArrowUpRightFromSquare}
          className="h-3 w-3 opacity-80"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (external) {
    return (
      <a
        href={item.href}
        target={/^mailto:/i.test(item.href || "") ? undefined : "_blank"}
        rel={
          /^mailto:/i.test(item.href || "") ? undefined : "noopener noreferrer"
        }
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link to={item.href} className={className}>
      {content}
    </Link>
  );
}

const InitiativeTemplate = ({ data }) => {
  const prefersReducedMotion = useReducedMotion();
  const images = useInitiativeImages();
  const [lightboxState, setLightboxState] = useState(null);

  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview(window.location.pathname);
  }, []);

  const {
    slug,
    title,
    category,
    tagline,
    subtitle,
    quickFacts = [],
    description = [],
    eventsTable,
    highlightsTitle,
    highlightsList = [],
    howToGetInvolved,
    links = [],
    leads = [],
    mainImageTitle,
    mainImageAlt,
    mainImage,
    galleryTitle,
    gallery = [],
  } = data || {};

  const catalogEntry = findCatalogEntry({ slug, title });
  const resolvedCategory = category || catalogEntry?.category || null;
  const heroSubtitle = tagline || subtitle || "";
  const pageDescription = summarizeDescription(
    heroSubtitle || description[0] || ""
  );

  const resolvedMainImage = useMemo(
    () => images.resolve(mainImage),
    [images, mainImage]
  );

  const mainImageNaturalWidth = resolvedMainImage?.featureImage?.width || 0;
  const mainImageNaturalHeight = resolvedMainImage?.featureImage?.height || 0;
  const isCompactMainImage =
    mainImageNaturalWidth > 0 && mainImageNaturalWidth < 600;
  const isSquareOrTallMainImage =
    mainImageNaturalWidth > 0 &&
    mainImageNaturalHeight / mainImageNaturalWidth > 0.85;
  const isCscHacksMascot =
    typeof mainImage === "string" && mainImage.includes("csc-hacks");
  const isSocialScreenshot =
    typeof mainImage === "string" && mainImage.includes("socialmedia-main-image");

  const resolvedMainAlt =
    mainImageAlt ||
    (mainImageTitle &&
    mainImageTitle.trim().toLowerCase() !== (title || "").trim().toLowerCase()
      ? mainImageTitle
      : `${title} photo`);

  const showMainCaption = Boolean(
    mainImageTitle &&
      mainImageTitle.trim().toLowerCase() !== (title || "").trim().toLowerCase()
  );

  const normalizedGallery = useMemo(() => {
    return (gallery || [])
      .map((entry, index) => {
        const src = typeof entry === "string" ? entry : entry?.src;
        if (!src) return null;
        const resolved = images.resolve(src);
        const alt =
          (typeof entry === "object" && entry?.alt) ||
          `${title} photo ${index + 1}`;
        const caption =
          (typeof entry === "object" && entry?.caption) || undefined;
        return {
          src,
          alt,
          caption,
          galleryImage: resolved?.galleryImage || null,
          featureImage: resolved?.featureImage || null,
          fallbackSrc: src,
        };
      })
      .filter(Boolean);
  }, [gallery, images, title]);

  const railLinks = useMemo(() => {
    if (links && links.length > 0) return links;
    return [
      { label: "Join Pitt CSC", href: "/join", external: false, primary: true },
      {
        label: "Join Discord",
        href: CLUB_SOCIALS.discord,
        external: true,
        primary: false,
      },
    ];
  }, [links]);

  const relatedInitiatives = useMemo(
    () =>
      getRelatedInitiatives({
        slug,
        title,
        category: resolvedCategory,
        count: 3,
      }),
    [slug, title, resolvedCategory]
  );

  const openSingleLightbox = () => {
    if (!mainImage) return;
    setLightboxState({
      items: [
        {
          alt: resolvedMainAlt,
          caption: showMainCaption ? mainImageTitle : undefined,
          featureImage: resolvedMainImage?.featureImage || null,
          fallbackSrc: mainImage,
        },
      ],
      index: 0,
    });
  };

  const openGalleryLightbox = (index) => {
    setLightboxState({
      items: normalizedGallery,
      index,
    });
  };

  const showGallerySubtitle =
    galleryTitle && galleryTitle.trim().length > 36;
  const galleryHeading = showGallerySubtitle
    ? "Photos"
    : galleryTitle || "Photos";

  return (
    <Layout
      title={`${title} | Computer Science Club at Pitt`}
      description={pageDescription}
      header="initiatives"
    >
      <div className="bg-white">
        <article className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-24 md:pt-10 pb-20">
          {/* Breadcrumb / back link */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <Link
              to="/initiatives/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
            >
              <FontAwesomeIcon
                icon={faArrowLeft}
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
              <span>All initiatives</span>
            </Link>
          </nav>

          {/* Hero header */}
          <header className="max-w-3xl pb-8 border-b border-slate-200">
            {resolvedCategory && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">
                {resolvedCategory}
              </span>
            )}

            <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
              <span className="relative inline-block pb-2">
                {title}
                <svg
                  className="svg-underline absolute bottom-0 left-0 w-full max-w-[260px]"
                  viewBox="0 0 422 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  {prefersReducedMotion ? (
                    <path
                      d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                      stroke="#FFB81C"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  ) : (
                    <motion.path
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ delay: 0.1, duration: 0.65 }}
                      d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                      stroke="#FFB81C"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </span>
            </h1>

            {heroSubtitle && (
              <p className="mt-4 text-lg sm:text-xl leading-relaxed text-slate-600">
                {heroSubtitle}
              </p>
            )}

            {links.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {links.map((item, index) => (
                  <ActionLink
                    key={`${item.label}-${index}`}
                    item={item}
                    variant={
                      item.primary || (index === 0 && !links.some((l) => l.primary))
                        ? "primary"
                        : "secondary"
                    }
                  />
                ))}
              </div>
            )}
          </header>

          {/* Main 2-column layout */}
          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12 items-start">
            {/* Editorial main column */}
            <div className="lg:col-span-8 space-y-10">
              {/* Full-color feature visual */}
              {mainImage && (
                <figure className="space-y-3">
                  <button
                    type="button"
                    onClick={openSingleLightbox}
                    aria-label={`Expand photo: ${resolvedMainAlt}`}
                    className={`group relative block w-full overflow-hidden rounded-2xl border border-slate-200 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      isSocialScreenshot
                        ? "bg-[#0d1115] p-3 sm:p-5"
                        : isCscHacksMascot
                        ? "bg-[#d1e2f3] p-6 sm:p-8 flex justify-center"
                        : isCompactMainImage || isSquareOrTallMainImage
                        ? "bg-slate-50 p-4 sm:p-6 flex justify-center"
                        : "bg-slate-100"
                    }`}
                  >
                    {resolvedMainImage?.featureImage ? (
                      <GatsbyImage
                        image={resolvedMainImage.featureImage}
                        alt={resolvedMainAlt}
                        loading="eager"
                        className={
                          isCompactMainImage || isSquareOrTallMainImage
                            ? "mx-auto rounded-xl"
                            : "w-full"
                        }
                        style={
                          isCompactMainImage
                            ? {
                                maxWidth: `${Math.min(
                                  mainImageNaturalWidth,
                                  420
                                )}px`,
                              }
                            : isSquareOrTallMainImage
                            ? { maxWidth: "460px", width: "100%" }
                            : undefined
                        }
                      />
                    ) : (
                      <img
                        src={mainImage}
                        alt={resolvedMainAlt}
                        className="w-full h-auto block"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-slate-900/75 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      <FontAwesomeIcon icon={faExpand} className="h-3 w-3" />
                      <span>Expand</span>
                    </span>
                  </button>
                  {showMainCaption && (
                    <figcaption className="text-sm text-slate-500">
                      {mainImageTitle}
                    </figcaption>
                  )}
                </figure>
              )}

              {/* Overview prose */}
              {description.length > 0 && (
                <section
                  aria-label="Overview"
                  className="space-y-4 max-w-[68ch]"
                >
                  {description.map((paragraph, index) => (
                    <p
                      key={index}
                      className="text-base sm:text-[17px] leading-[1.8] text-slate-700"
                    >
                      {paragraph}
                    </p>
                  ))}
                </section>
              )}

              {/* Highlights */}
              {highlightsList.length > 0 && (
                <section className="pt-8 border-t border-slate-200">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    {highlightsTitle || "What to expect"}
                  </h2>
                  <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
                    {highlightsList.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-base leading-relaxed text-slate-700"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-secondary-200/80 text-primary"
                        >
                          <FontAwesomeIcon
                            icon={faCheck}
                            className="h-2.5 w-2.5"
                          />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Schedule & Events Table */}
              {eventsTable &&
                eventsTable.rows &&
                eventsTable.rows.length > 0 && (
                  <section className="pt-8 border-t border-slate-200">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                      {eventsTable.title || "Schedule & sessions"}
                    </h2>
                    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-left">
                        {eventsTable.headers &&
                          eventsTable.headers.length > 0 && (
                            <thead className="bg-slate-50">
                              <tr>
                                {eventsTable.headers.map((header, idx) => (
                                  <th
                                    key={idx}
                                    scope="col"
                                    className="px-5 py-3.5 text-xs font-semibold text-slate-600"
                                  >
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                          )}
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {eventsTable.rows.map((row, rowIdx) => (
                            <tr
                              key={rowIdx}
                              className={
                                rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                              }
                            >
                              {row.map((cell, cellIdx) => (
                                <td
                                  key={cellIdx}
                                  className={`px-5 py-3.5 text-sm leading-relaxed ${
                                    cellIdx === 0
                                      ? "font-semibold text-slate-900"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
            </div>

            {/* Right sticky side rail */}
            <aside className="lg:col-span-4 lg:sticky lg:top-8 space-y-6">
              {/* At a glance */}
              {quickFacts.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6">
                  <h2 className="text-base font-bold text-slate-900">
                    At a glance
                  </h2>
                  <dl className="mt-4 divide-y divide-slate-200/80">
                    {quickFacts.map((fact, idx) => (
                      <div
                        key={`${fact.label}-${idx}`}
                        className={idx === 0 ? "pb-3" : "py-3 last:pb-0"}
                      >
                        <dt className="text-xs font-semibold text-slate-500">
                          {fact.label}
                        </dt>
                        <dd className="mt-0.5 text-sm font-medium leading-snug text-slate-900">
                          {fact.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* How to get involved — single bold Pitt Navy anchor */}
              <div
                className="rounded-2xl bg-primary p-6 text-white shadow-sm"
                style={{ backgroundColor: "#243E8B" }}
              >
                <div
                  className="h-1 w-10 rounded-full bg-secondary-100"
                  aria-hidden="true"
                />
                <h2 className="mt-4 text-lg font-bold text-white">
                  How to get involved
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-blue-100">
                  {howToGetInvolved?.summary ||
                    "Announcements, room locations, and signup forms go out in Discord and on the club Google Calendar."}
                </p>

                {howToGetInvolved?.steps &&
                  howToGetInvolved.steps.length > 0 && (
                    <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-blue-50">
                      {howToGetInvolved.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="font-bold text-secondary-100 tabular-nums">
                            {idx + 1}.
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                <div className="mt-5 flex flex-col gap-2.5">
                  {railLinks.map((item, idx) => (
                    <ActionLink
                      key={`${item.label}-rail-${idx}`}
                      item={item}
                      onDark
                      variant={
                        item.primary ||
                        (idx === 0 && !railLinks.some((l) => l.primary))
                          ? "primary"
                          : "secondary"
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Program Leads (rendered only when verified leads exist) */}
              {leads.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="text-base font-bold text-slate-900">
                    {leads.length === 1 ? "Program lead" : "Program leads"}
                  </h2>
                  <ul className="mt-4 space-y-4">
                    {leads.map((lead, idx) => (
                      <li key={`${lead.name}-${idx}`}>
                        <p className="text-sm font-bold text-slate-900">
                          {lead.name}
                        </p>
                        {lead.role && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {lead.role}
                          </p>
                        )}
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
                          >
                            <FontAwesomeIcon
                              icon={faEnvelope}
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            <span>{lead.email}</span>
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>

          {/* Photo Gallery */}
          {normalizedGallery.length > 0 && (
            <section className="mt-16 pt-12 border-t border-slate-200">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  {galleryHeading}
                </h2>
                {showGallerySubtitle && (
                  <p className="mt-2 text-base text-slate-600">
                    {galleryTitle}
                  </p>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
                {normalizedGallery.map((photo, index) => (
                  <button
                    key={`${photo.src}-${index}`}
                    type="button"
                    onClick={() => openGalleryLightbox(index)}
                    aria-label={`Open photo ${index + 1}: ${photo.alt}`}
                    className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {photo.galleryImage ? (
                      <GatsbyImage
                        image={photo.galleryImage}
                        alt={photo.alt}
                        loading="lazy"
                        className="h-full w-full"
                        imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                        imgStyle={{ objectPosition: "50% 25%" }}
                      />
                    ) : (
                      <img
                        src={photo.fallbackSrc}
                        alt={photo.alt}
                        loading="lazy"
                        className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-2.5 bottom-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      <FontAwesomeIcon icon={faExpand} className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Explore more initiatives */}
          <section className="mt-20 pt-12 border-t border-slate-200">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Explore more initiatives
              </h2>
              <Link
                to="/initiatives/"
                className="text-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
              >
                View all initiatives
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {relatedInitiatives.map((item) => {
                const resolved = images.resolve(item.imagePath);
                const useContain = item.cardFit === "contain";
                const cardImageData = useContain
                  ? resolved?.galleryImage
                  : resolved?.cardImage;

                const cardInner = (
                  <>
                    <div
                      className="relative aspect-video w-full overflow-hidden bg-slate-100"
                      style={
                        item.cardBg
                          ? { backgroundColor: item.cardBg }
                          : undefined
                      }
                    >
                      {cardImageData && (
                        <GatsbyImage
                          image={cardImageData}
                          alt={item.name}
                          loading="lazy"
                          objectFit={useContain ? "contain" : "cover"}
                          className="h-full w-full"
                        />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <span className="inline-flex w-fit rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {item.category}
                      </span>
                      <h3 className="mt-2.5 text-lg font-bold text-slate-900 transition-colors group-hover:text-primary">
                        {item.name}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        {item.defaultBlurb}
                      </p>
                    </div>
                  </>
                );

                const cardClass =
                  "group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors duration-200 hover:border-primary/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

                return item.external ? (
                  <a
                    key={item.slug}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardClass}
                  >
                    {cardInner}
                  </a>
                ) : (
                  <Link key={item.slug} to={item.link} className={cardClass}>
                    {cardInner}
                  </Link>
                );
              })}
            </div>
          </section>
        </article>
      </div>

      {/* Accessible Photo Lightbox */}
      <LightboxModal
        items={lightboxState?.items || []}
        activeIndex={lightboxState ? lightboxState.index : null}
        onClose={() => setLightboxState(null)}
        onSelectIndex={(nextIndex) =>
          setLightboxState((prev) =>
            prev ? { ...prev, index: nextIndex } : null
          )
        }
        title={title}
      />
    </Layout>
  );
};

export default InitiativeTemplate;
