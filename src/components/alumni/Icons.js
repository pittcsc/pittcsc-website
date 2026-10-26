// Keep the port's icon interface while reusing the CRM's installed icon library.
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMapMarkerAlt,
  faBriefcase,
  faCalendar,
  faMugHot,
  faUsers,
  faShareAlt,
  faGlobe,
  faEnvelope,
  faBuilding,
  faFileAlt,
  faSearch,
  faFilter,
  faTimes,
  faChevronDown,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import { faLinkedin } from "@fortawesome/free-brands-svg-icons";
const icon = (value) => (props) => (
  <FontAwesomeIcon icon={value} aria-hidden="true" {...props} />
);
export const MapPin = icon(faMapMarkerAlt),
  Briefcase = icon(faBriefcase),
  Calendar = icon(faCalendar),
  Coffee = icon(faMugHot),
  Users = icon(faUsers),
  Share2 = icon(faShareAlt),
  Linkedin = icon(faLinkedin),
  Globe = icon(faGlobe),
  Mail = icon(faEnvelope),
  Building = icon(faBuilding),
  FileText = icon(faFileAlt),
  Search = icon(faSearch),
  Filter = icon(faFilter),
  X = icon(faTimes),
  ChevronDown = icon(faChevronDown),
  ArrowLeft = icon(faArrowLeft);
