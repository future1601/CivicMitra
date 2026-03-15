import { useState, useEffect } from "react";
import { Card } from "./ui/card";

// MapBox Code
import React from "react";
import MapboxMap from "./ui/mapboxMap";
import { apiService, Location, FilterOptions } from "../services/api";

interface Complaint {
  id: string;
  title: string;
  location: string;
  severity: "low" | "medium" | "high";
  description?: string;
  submittedBy?: string;
  submittedDate?: string;
  category?: string;
  status?: string;
  imagePath?: string;
}

interface JharkhandHeatmapProps {
  onComplaintClick?: (complaint: Complaint) => void;
}

const JharkhandHeatmap = ({ onComplaintClick }: JharkhandHeatmapProps) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(
    null
  );

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Popup state
  const [selectedComplaint, setSelectedComplaint] = useState<Location | null>(
    null
  );

  // Handler to show popup only (no navigation)
  const handleMarkerClick = (location: Location) => {
    setSelectedComplaint(location);
    // Only show popup, don't navigate to another page
  };

  // Handler for "View Full Details" button
  const handleViewFullDetails = (location: Location) => {
    if (onComplaintClick && location.report_id) {
      // Convert Location to Complaint format
      const complaint: Complaint = {
        id: location.report_id,
        title: location.name,
        location: `${location.lat}, ${location.lng}`,
        severity: (location.priority as "low" | "medium" | "high") || "medium",
        description: location.description,
        submittedDate: location.created_at,
        category: location.category,
        status: location.status,
        submittedBy: location.phone_number,
        imagePath: location.report_id ? location.report_id + ".jpg" : undefined, // Assuming images are stored as report_id.jpg
      };
      onComplaintClick(complaint);
    }
  };
  const loadReportLocations = async (applyFilters = false) => {
    try {
      setLoading(true);

      // Check if backend is connected
      const connected = await apiService.checkConnection();
      setIsConnected(connected);

      if (connected) {
        // Load filter options on first load
        if (!filterOptions) {
          try {
            const options = await apiService.getFilterOptions();
            setFilterOptions(options);
          } catch (error) {
            console.error("Failed to load filter options:", error);
          }
        }

        // Build filter object
        const filters: any = {};
        if (applyFilters) {
          if (selectedCategory) filters.category = selectedCategory;
          if (selectedPriority) filters.priority = selectedPriority;
          if (selectedDepartment) filters.department = selectedDepartment;
          if (selectedStatus) filters.status = selectedStatus;
        }

        // Load real report locations from backend with filters
        const reportLocations = await apiService.getReportsByLocation(
          Object.keys(filters).length > 0 ? filters : undefined
        );
        console.log("Received locations from backend:", reportLocations);

        if (reportLocations && reportLocations.length > 0) {
          // Ensure all locations have valid coordinates
          const validLocations = reportLocations.filter(
            (loc) =>
              loc.lat &&
              loc.lng &&
              typeof loc.lat === "number" &&
              typeof loc.lng === "number" &&
              !isNaN(loc.lat) &&
              !isNaN(loc.lng)
          );

          console.log("Valid locations:", validLocations);
          setLocations(validLocations);
        } else {
          setLocations([]);
        }
      }
    } catch (error) {
      console.error("Failed to load report locations:", error);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportLocations();

    // Set up auto-refresh every 30 seconds to get new complaints
    const interval = setInterval(() => loadReportLocations(true), 600000);
    return () => clearInterval(interval);
  }, []);

  // Reload when filters change
  useEffect(() => {
    if (isConnected) {
      loadReportLocations(true);
    }
  }, [selectedCategory, selectedPriority, selectedDepartment, selectedStatus]);

  const refreshLocations = async () => {
    await loadReportLocations(true);
  };

  const clearFilters = () => {
    setSelectedCategory("");
    setSelectedPriority("");
    setSelectedDepartment("");
    setSelectedStatus("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2>Complaint Locations ({locations.length} markers)</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={refreshLocations}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <span className="text-sm text-gray-600">
              {isConnected ? "Backend Connected" : "Using Demo Data"}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      {filterOptions && isConnected && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-700">Filter Complaints</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear All Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {filterOptions.categories.available.map((category) => (
                  <option key={category} value={category}>
                    {category
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Priority
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Priorities</option>
                {filterOptions.priorities.available.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {filterOptions.departments.available.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {filterOptions.statuses.available.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(selectedCategory ||
            selectedPriority ||
            selectedDepartment ||
            selectedStatus) && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {selectedCategory && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  Category: {selectedCategory.replace(/_/g, " ")}
                </span>
              )}
              {selectedPriority && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                  Priority: {selectedPriority}
                </span>
              )}
              {selectedDepartment && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                  Department: {selectedDepartment}
                </span>
              )}
              {selectedStatus && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                  Status: {selectedStatus}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {loading ? (
        <div className="h-[500px] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading locations...</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-4" style={{ height: "600px" }}>
          {/* Map Container - Fixed 4:2 ratio (66.67% width) */}
          <div
            className="flex-grow"
            style={{ width: "66.67%", minWidth: "66.67%" }}
          >
            <MapboxMap
              locations={locations}
              onMarkerClick={handleMarkerClick}
            />
          </div>

          {/* Side Popup - Always visible, fixed 4:2 ratio (33.33% width) */}
          <div
            className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
            style={{ width: "33.33%", minWidth: "33.33%", height: "600px" }}
          >
            {selectedComplaint ? (
              <div className="h-full flex flex-col">
                {/* Fixed Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Complaint Details
                  </h3>
                  <button
                    onClick={() => setSelectedComplaint(null)}
                    className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
                  >
                    ×
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    {/* Report ID */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Report ID
                      </label>
                      <p className="text-sm bg-gray-50 p-2 rounded border font-mono">
                        {selectedComplaint.report_id}
                      </p>
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Phone Number
                      </label>
                      <p className="text-sm bg-gray-50 p-2 rounded border">
                        {selectedComplaint.phone_number}
                      </p>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Description
                      </label>
                      <p className="text-sm bg-gray-50 p-3 rounded border leading-relaxed">
                        {selectedComplaint.description}
                      </p>
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Category
                      </label>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          selectedComplaint.category === "road_infrastructure"
                            ? "bg-red-100 text-red-800"
                            : selectedComplaint.category === "electricity_power"
                            ? "bg-yellow-100 text-yellow-800"
                            : selectedComplaint.category === "water_sanitation"
                            ? "bg-blue-100 text-blue-800"
                            : selectedComplaint.category === "waste_management"
                            ? "bg-brown-100 text-brown-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {selectedComplaint.category
                          ?.replace("_", " ")
                          .toUpperCase()}
                      </span>
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Priority
                      </label>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          selectedComplaint.priority === "very_high"
                            ? "bg-red-500 text-white"
                            : selectedComplaint.priority === "high"
                            ? "bg-orange-100 text-orange-800"
                            : selectedComplaint.priority === "medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {selectedComplaint.priority
                          ?.replace("_", " ")
                          .toUpperCase()}
                      </span>
                    </div>

                    {/* Department */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Department
                      </label>
                      <p className="text-sm bg-gray-50 p-2 rounded border">
                        {selectedComplaint.department}
                      </p>
                    </div>

                    {/* Resolution Days */}
                    {selectedComplaint.resolution_days && (
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Expected Resolution
                        </label>
                        <p className="text-sm bg-blue-50 p-2 rounded border text-blue-800">
                          {selectedComplaint.resolution_days} days
                        </p>
                      </div>
                    )}

                    {/* Status */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Status
                      </label>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          selectedComplaint.status === "resolved"
                            ? "bg-green-100 text-green-800"
                            : selectedComplaint.status === "in_progress"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {selectedComplaint.status
                          ?.replace("_", " ")
                          .toUpperCase()}
                      </span>
                    </div>

                    {/* Created Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Submitted On
                      </label>
                      <p className="text-sm bg-gray-50 p-2 rounded border">
                        {selectedComplaint.created_at
                          ? new Date(
                              selectedComplaint.created_at
                            ).toLocaleString()
                          : "Unknown"}
                      </p>
                    </div>

                    {/* Coordinates */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Location
                      </label>
                      <p className="text-sm bg-gray-50 p-2 rounded border font-mono">
                        Lat: {selectedComplaint.lat.toFixed(6)}, Lng:{" "}
                        {selectedComplaint.lng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                {onComplaintClick && selectedComplaint && (
                  <div className="border-t border-gray-200 p-4">
                    <button
                      onClick={() => handleViewFullDetails(selectedComplaint)}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
                    >
                      View Full Details
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium text-gray-700 mb-2">
                    Select a Complaint
                  </h4>
                  <p className="text-sm text-gray-500">
                    Click on any marker on the map to view detailed information
                    about the complaint.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JharkhandHeatmap;
