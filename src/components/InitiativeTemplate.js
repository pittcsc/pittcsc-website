import React, { useEffect, useState } from "react";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import { motion } from "framer-motion";
import Layout from "../layouts/layout";

const InitiativeTemplate = ({ data }) => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    // Optionally we could track dynamically based on page title, but falling back to generic for now
    ReactGA.pageview(window.location.pathname);
  }, []);

  const [selectedImage, setSelectedImage] = useState(null);

  // Destructure the global object schema
  const {
    title,
    subtitle,
    description = [],
    eventsTable,
    highlightsTitle,
    highlightsList = [],
    mainImageTitle,
    mainImage,
    galleryTitle,
    gallery = []
  } = data;

  return (
    <Layout title={`${title} | Computer Science Club @ Pitt`} header={title}>
      <motion.div
        className="overflow-hidden relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 my-8 min-h-screen space-y-16 xl:my-24">
          <section className="container relative z-10 mx-auto px-4 w-full md:px-0 lg:w-8/12">
            
            {/* Hero Section */}
            <div className="flex flex-col items-center justify-center mb-12">
              <h1 className="relative z-10 mb-4 text-center text-4xl font-bold lg:text-6xl">
                {title}
                <svg
                  className="svg-underline absolute -bottom-2 left-1/2 transform -translate-x-1/2 z-0 w-64 lg:w-full max-w-sm"
                  viewBox="0 0 422 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    d="M3 9C118.957 4.47226 364.497 -1.86658 419 9"
                    stroke="#FFB81C"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </h1>
              {subtitle && (
                <p className="text-xl text-gray-600 mt-4 text-center max-w-2xl">{subtitle}</p>
              )}
            </div>

            {/* Content Section */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 lg:p-12 shadow-sm border border-gray-100 mb-16 relative z-10">
              
              {/* Paragraphs */}
              {description.length > 0 && (
                <div className="mb-12 space-y-4">
                  {description.map((paragraph, index) => (
                    <p key={index} className="text-lg leading-relaxed text-gray-700">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}

              {/* Events Table Section (Optional) */}
              {eventsTable && eventsTable.rows && eventsTable.rows.length > 0 && (
                <div className="mb-12 overflow-x-auto">
                   <h3 className="text-2xl font-bold text-primary mb-6">Schedule & Events</h3>
                   <table className="min-w-full divide-y divide-gray-200 border rounded-lg overflow-hidden shadow-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {eventsTable.headers?.map((header, idx) => (
                             <th key={idx} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {header}
                             </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {eventsTable.rows.map((row, rowIdx) => (
                           <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              {row.map((cell, cellIdx) => (
                                 <td key={cellIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                   {cell}
                                 </td>
                              ))}
                           </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              )}

              {/* Highlights Section */}
              {highlightsList.length > 0 && (
                <div className="mb-12">
                  <h3 className="text-2xl font-bold text-primary mb-6">{highlightsTitle || "Highlights"}</h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {highlightsList.map((item, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <span className="text-yellow-400 font-bold text-xl">•</span>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Main Image Section */}
              {mainImage && (
                <div className="mb-12">
                  {mainImageTitle && <h3 className="text-2xl font-bold text-primary mb-6">{mainImageTitle}</h3>}
                  <div className="rounded-xl overflow-hidden shadow-sm border-4 border-yellow-400 group">
                    <img
                      src={mainImage}
                      alt={mainImageTitle || "Initiative main visual"}
                      className="w-full h-auto filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                    />
                  </div>
                </div>
              )}

              {/* Gallery Title */}
              {gallery.length > 0 && galleryTitle && (
                <p className="text-lg leading-relaxed text-gray-700 mt-8">
                  {galleryTitle}
                </p>
              )}
            </div>

            {/* Gallery Grid */}
            {gallery.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                {gallery.map((src, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    className="rounded-xl overflow-hidden shadow-lg h-64 bg-gray-100 cursor-pointer"
                    onClick={() => setSelectedImage(src)}
                  >
                    <img
                      src={src}
                      alt={`${title} Gallery ${index + 1}`}
                      className="w-full h-full object-cover object-top hover:opacity-90 transition-opacity duration-300"
                    />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Modal */}
            {selectedImage && (
              <div
                className="fixed z-50 inset-0 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                onClick={() => setSelectedImage(null)}
              >
                <img
                  src={selectedImage}
                  alt="Enlarged view"
                  className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                />
              </div>
            )}

            {/* Polka Dot Patterns */}
            <div className="polka-background absolute top-0 -left-20 z-0 opacity-30 hidden lg:block"></div>
            <div className="polka-background absolute bottom-0 -right-20 z-0 opacity-30 hidden lg:block" style={{ transform: 'rotate(180deg)' }}></div>
          </section>
        </div>
      </motion.div>
    </Layout>
  );
};

export default InitiativeTemplate;
