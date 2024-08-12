import { graphql } from "gatsby";
import React, { useEffect } from "react";
import { hotjar } from "react-hotjar";
import ReactGA from "react-ga";
import Layout from "../layouts/layout";
import { motion } from "framer-motion";
import ProjectCard from "../components/ProjectCard";

const ProjectsPage = ({ data }) => {
  useEffect(() => {
    hotjar.initialize(2276434, 6);
    ReactGA.initialize("UA-58446605-1");
    ReactGA.pageview("/join");
  }, []);

  const projects = data.allGoogleSpreadsheetProjects.edges.map(
    (edge) => edge.node
  );

  const projectsByYear = projects.reduce((acc, project) => {
    if (!acc[project.projectYear]) {
      acc[project.projectYear] = [project];
    } else {
      acc[project.projectYear].push(project);
    }

    return acc;
  }, {});
  const projectYearsAscending = Object.keys(projectsByYear).sort((a, b) => {
    // Natural sort of years
    return b.localeCompare(a, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  return (
    <Layout title="Projects | Pitt Computer Science Club" header="projects">
      <motion.div
        className="overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="container mx-auto my-16 w-full">
          {projectYearsAscending.map((year) => (
            <div key={year} className="mt-16">
              <h1 className="text-4xl">{year}</h1>
              <hr />
              <div className="flex flex-col items-center justify-center">
                <div className="grid gap-12 2xl:gap-16 grid-cols-1 2xl:grid-cols-3 my-8 lg:grid-cols-2">
                  {projectsByYear[year].map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </Layout>
  );
};

export const query = graphql`
  {
    allGoogleSpreadsheetProjects {
      edges {
        node {
          awards
          description
          id
          name
          repoLink
          projectYear
          videoLink
          teamMembers
        }
      }
    }
  }
`;

export default ProjectsPage;
