import React, { useEffect } from "react";
import { Link } from "gatsby";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import Layout from "../../layouts/layout";

const ComingSoonPage = () => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/initiatives/coming-soon");
  }, []);

  return (
    <Layout
      title="Coming Soon | Computer Science Club at Pitt"
      header="initiatives"
    >
      <div className="bg-white">
        <section className="mx-auto max-w-3xl px-4 sm:px-6 pt-24 md:pt-14 pb-24">
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

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/70 p-8 sm:p-12">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Coming Soon
            </h1>
            <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
              This initiative page is still being put together. Check back soon
              or browse the rest of our active Pitt CSC programs in the
              meantime.
            </p>
            <div className="mt-6">
              <Link
                to="/initiatives/"
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                style={{ backgroundColor: "#243E8B" }}
              >
                Browse all initiatives
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default ComingSoonPage;
