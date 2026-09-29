import * as React from "react";
import { Link } from "gatsby";
import Layout from "../layouts/layout";

const NotFoundPage = () => (
  <Layout title="Page not found | Computer Science Club @ Pitt" showFooter={false}>
    <section className="flex min-h-[70vh] items-center justify-center px-6 py-20 text-center">
      <div>
        <h1 className="text-2xl font-bold text-primary md:text-3xl">
          Page not found
        </h1>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-bold text-white transition hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Go home
        </Link>
      </div>
    </section>
  </Layout>
);

export default NotFoundPage;
