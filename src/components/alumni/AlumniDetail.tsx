// Layout ported from PittCSC-Alumni-Database at 3ac2f46; see docs/ALUMNI.md.
import React from "react";
import { MapPin, Briefcase, Calendar, Linkedin, ArrowLeft } from "./Icons";
import ProtectedPhoto from "./ProtectedPhoto";
export default function AlumniDetail({ alumni, request, userID, onBack }) {
  return (
    <div className="min-h-screen bg-pittLight py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center text-pittNavy hover:text-pittDeepNavy"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Alumni List
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-pittDeepNavy text-white flex justify-between items-center">
            <h1 className="text-2xl font-bold">Alumni Profile</h1>
          </div>

          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-start">
              <div className="md:w-1/3 mb-6 md:mb-0 md:pr-6">
                <div className="flex items-center mb-4">
                  <div className="mr-4 flex-shrink-0">
                    <div className="h-24 w-24 rounded-full overflow-hidden">
                      <ProtectedPhoto
                        id={alumni.id}
                        name={alumni.full_name}
                        request={request}
                        userID={userID}
                        updatedAt={alumni.updated_at}
                      />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-pittDeepNavy">
                      {alumni.full_name}
                    </h2>
                    {(alumni.current_role || alumni.current_company) && (
                      <p className="text-gray-600">
                        {alumni.current_role}
                        {alumni.current_role && alumni.current_company
                          ? " at "
                          : ""}
                        {alumni.current_company}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-500 mb-4">
                  {alumni.position_is_current
                    ? "Current position"
                    : "Most recent position"}
                </p>
                <div className="space-y-3 mb-6">
                  {alumni.location && (
                    <div className="flex items-center text-gray-600">
                      <MapPin className="h-5 w-5 mr-2 text-pittNavy" />
                      <span>{alumni.location}</span>
                    </div>
                  )}

                  {alumni.graduation_year && (
                    <div className="flex items-center text-gray-600">
                      <Calendar className="h-5 w-5 mr-2 text-pittNavy" />
                      <span>Class of {alumni.graduation_year}</span>
                    </div>
                  )}

                  {(alumni.current_role || alumni.current_company) && (
                    <div className="flex items-center text-gray-600">
                      <Briefcase className="h-5 w-5 mr-2 text-pittNavy" />
                      <span>
                        {alumni.current_role}
                        {alumni.current_role && alumni.current_company
                          ? " at "
                          : ""}
                        {alumni.current_company}
                      </span>
                    </div>
                  )}

                  <a
                    href={`mailto:${alumni.contact_email}`}
                    className="block text-pittNavy hover:underline"
                  >
                    {alumni.contact_email}
                  </a>
                  {alumni.linkedin_url && (
                    <div className="flex items-center text-gray-600">
                      <Linkedin className="h-5 w-5 mr-2 text-pittNavy" />
                      <a
                        href={alumni.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pittNavy hover:underline"
                      >
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                </div>

                <div className="bg-pittLight rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-semibold text-pittDeepNavy mb-3">
                    Availability
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-2 ${alumni.open_to_coffee_chats ? "bg-green-500" : "bg-gray-300"}`}
                      ></div>
                      <span
                        className={
                          alumni.open_to_coffee_chats
                            ? "text-gray-800"
                            : "text-gray-500"
                        }
                      >
                        {alumni.open_to_coffee_chats
                          ? "Open to"
                          : "Not available for"}{" "}
                        Coffee Chats
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-2 ${alumni.open_to_mentorship ? "bg-green-500" : "bg-gray-300"}`}
                      ></div>
                      <span
                        className={
                          alumni.open_to_mentorship
                            ? "text-gray-800"
                            : "text-gray-500"
                        }
                      >
                        {alumni.open_to_mentorship
                          ? "Open to"
                          : "Not available for"}{" "}
                        Mentorship
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-2 ${alumni.available_for_referrals ? "bg-green-500" : "bg-gray-300"}`}
                      ></div>
                      <span
                        className={
                          alumni.available_for_referrals
                            ? "text-gray-800"
                            : "text-gray-500"
                        }
                      >
                        {alumni.available_for_referrals
                          ? "Available for"
                          : "Not available for"}{" "}
                        Referrals
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-2 ${alumni.open_to_resume_review ? "bg-green-500" : "bg-gray-300"}`}
                      ></div>
                      <span
                        className={
                          alumni.open_to_resume_review
                            ? "text-gray-800"
                            : "text-gray-500"
                        }
                      >
                        {alumni.open_to_resume_review
                          ? "Open to"
                          : "Not available for"}{" "}
                        Resume Review
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:w-2/3">
                <div className="bg-pittLight rounded-lg p-6 mb-6">
                  <p className="text-sm text-gray-500 mb-4">
                    Profile last updated:{" "}
                    {new Date(alumni.updated_at).toLocaleDateString("en-US", {
                      timeZone: "America/New_York",
                    })}
                  </p>
                  <h3 className="text-lg font-semibold text-pittDeepNavy mb-4">
                    About
                  </h3>
                  {alumni.bio ? (
                    <p className="text-gray-600">{alumni.bio}</p>
                  ) : (
                    <p className="text-gray-500">No bio available</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
