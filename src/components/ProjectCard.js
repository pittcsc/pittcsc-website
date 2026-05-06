import React from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";

const YOUTUBE_LINK_ID_REGEX =
  /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;

const ProjectCard = ({ project }) => {
  const videoId = project.videoLink?.match(YOUTUBE_LINK_ID_REGEX)[1];

  return (
    <div
      className={`flex flex-col relative w-128 bg-gray-100 rounded-2xl focus:outline-none
      hover:shadow-lg shadow-md transform-gpu hover:scale-105 active:scale-95
      transition md:w-128`}
    >
      {videoId ? (
        <div className="video-container">
          <iframe
            width="560"
            height="315"
            src={`https://www.youtube.com/embed/${videoId}`}
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      ) : null}
      <figcaption className="mt-auto p-8 text-center">
        <div className="mb-4 text-lg font-medium md:text-xl">
          {project.name}
        </div>
        {project.description && (
          <div className="px-2 text-xs italic">{project.description}</div>
        )}
        {project.teamMembers && (
          <div className="mt-2 mx-auto px-2 w-80 text-xs">
            {project.teamMembers}
          </div>
        )}
      </figcaption>
      {project.repoLink ? (
        <motion.a
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          href={project.repoLink}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-4 left-4 flex items-center justify-center text-2xl"
        >
          <FontAwesomeIcon icon={faGithub} />
        </motion.a>
      ) : null}
    </div>
  );
};

export default ProjectCard;
