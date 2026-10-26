// Ported from PittCSC-Alumni-Database at 3ac2f46; see docs/ALUMNI.md.
import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  X,
  MapPin,
  Calendar,
  Building,
  Coffee,
  Users,
  Share2,
  FileText,
  ChevronDown,
} from "./Icons";
import { AlumniFilters as FiltersType } from "./types";

interface AlumniFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  onSearch: (searchTerm: string) => void;
  totalResults: number;
  uniqueLocations?: string[];
  uniqueCompanies?: string[];
  uniqueYears?: number[];
}

const AlumniFilters: React.FC<AlumniFiltersProps> = ({
  filters,
  onFiltersChange,
  onSearch,
  totalResults,
  uniqueLocations = [],
  uniqueCompanies = [],
  uniqueYears = [],
}) => {
  const [searchTerm, setSearchTerm] = useState(filters.search || "");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const localFilters = filters;
  useEffect(() => setSearchTerm(filters.search || ""), [filters.search]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm !== (filters.search || "")) {
        onSearch(searchTerm);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, filters.search, onSearch]);

  const handleFilterChange = (key: keyof FiltersType, value: any) => {
    const newFilters = { ...localFilters, [key]: value };

    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    setSearchTerm("");

    onFiltersChange({});
  };

  const hasActiveFilters = () => {
    return (
      Object.keys(localFilters).some(
        (key) =>
          key !== "search" &&
          localFilters[key as keyof FiltersType] !== undefined,
      ) || searchTerm !== ""
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-soft p-6 mb-8">
      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="search"
          aria-label="Search alumni"
          maxLength={100}
          placeholder="Search by name, company, or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pittGold focus:border-transparent text-gray-700 placeholder-gray-400"
        />
        {searchTerm && (
          <button
            aria-label="Clear search"
            onClick={() => setSearchTerm("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip
          icon={<Coffee className="h-4 w-4" />}
          label="Coffee Chats"
          active={localFilters.open_to_coffee_chats === true}
          onClick={() =>
            handleFilterChange(
              "open_to_coffee_chats",
              localFilters.open_to_coffee_chats === true ? undefined : true,
            )
          }
        />
        <FilterChip
          icon={<Users className="h-4 w-4" />}
          label="Mentorship"
          active={localFilters.open_to_mentorship === true}
          onClick={() =>
            handleFilterChange(
              "open_to_mentorship",
              localFilters.open_to_mentorship === true ? undefined : true,
            )
          }
        />
        <FilterChip
          icon={<Share2 className="h-4 w-4" />}
          label="Referrals"
          active={localFilters.available_for_referrals === true}
          onClick={() =>
            handleFilterChange(
              "available_for_referrals",
              localFilters.available_for_referrals === true ? undefined : true,
            )
          }
        />
        <FilterChip
          icon={<FileText className="h-4 w-4" />}
          label="Resume Review"
          active={localFilters.open_to_resume_review === true}
          onClick={() =>
            handleFilterChange(
              "open_to_resume_review",
              localFilters.open_to_resume_review === true ? undefined : true,
            )
          }
        />

        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          <ChevronDown
            className={`h-4 w-4 ml-2 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 animate-slide-down">
          {/* Location Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline h-4 w-4 mr-1" />
              Location
            </label>
            <select
              aria-label="Location"
              value={localFilters.location || ""}
              onChange={(e) =>
                handleFilterChange("location", e.target.value || undefined)
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pittGold focus:border-transparent"
            >
              <option value="">All Locations</option>
              {uniqueLocations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          {/* Company Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building className="inline h-4 w-4 mr-1" />
              Company
            </label>
            <select
              aria-label="Company"
              value={localFilters.company || ""}
              onChange={(e) =>
                handleFilterChange("company", e.target.value || undefined)
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pittGold focus:border-transparent"
            >
              <option value="">All Companies</option>
              {uniqueCompanies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </div>

          {/* Graduation Year Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Graduation Year
            </label>
            <select
              aria-label="Graduation year"
              value={localFilters.graduation_year || ""}
              onChange={(e) =>
                handleFilterChange(
                  "graduation_year",
                  e.target.value ? parseInt(e.target.value) : undefined,
                )
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pittGold focus:border-transparent"
            >
              <option value="">All Years</option>
              {uniqueYears.map((year) => (
                <option key={year} value={year}>
                  Class of {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Results Summary and Clear Filters */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <p className="text-sm text-gray-600">
          Found{" "}
          <span className="font-semibold text-pittNavy">{totalResults}</span>{" "}
          alumni
          {hasActiveFilters() && " matching your criteria"}
        </p>

        {hasActiveFilters() && (
          <button
            onClick={clearAllFilters}
            className="text-sm font-medium text-gray-500 hover:text-pittNavy transition-colors flex items-center"
          >
            <X className="h-4 w-4 mr-1" />
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
};

const FilterChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    aria-pressed={active}
    onClick={onClick}
    className={`inline-flex items-center px-4 py-2 rounded-lg transition-all ${
      active
        ? "bg-pittGold text-pittDarkNavy font-medium shadow-sm"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
    }`}
  >
    {icon}
    <span className="ml-2">{label}</span>
  </button>
);

export default AlumniFilters;
