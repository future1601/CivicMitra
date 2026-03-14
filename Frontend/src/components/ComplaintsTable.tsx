import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Search, Filter, Eye } from "lucide-react";
import { Input } from "./ui/input";
import { apiService, Report } from "../services/api";

interface Complaint {
  id: string;
  title: string;
  location: string;
  severity: "low" | "medium" | "high";
  submittedDate: string;
  status: string;
  category: string;
  imagePath?: string;
  description?: string;
  submittedBy?: string;
}

interface ComplaintsTableProps {
  onViewComplaint: (complaint: Complaint) => void;
}

export function ComplaintsTable({ onViewComplaint }: ComplaintsTableProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiService.getAllReports();
      setReports(data);
    } catch (err) {
      setError("Failed to fetch complaints. Please try again.");
      console.error("Error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  };

  // Convert Report to Complaint format for compatibility
  const complaints: Complaint[] = reports.map((report) => ({
    id: report.report_id,
    title:
      report.description.length > 50
        ? report.description.substring(0, 50) + "..."
        : report.description,
    description: report.description, // Full description for details page
    location:
      report.address_extracted ||
      `${report.location_lat}, ${report.location_lon}`,
    severity: report.priority as "low" | "medium" | "high",
    submittedDate: report.created_at,
    status: report.status,
    category: report.category,
    submittedBy: report.citizen_phone,
    imagePath: report.image_path
      ? report.image_path.split(/[/\\]/).pop() // Handle both forward and back slashes
      : undefined, // Extract filename from path
  }));

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "very_high":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "bg-green-100 text-green-800 border-green-200";
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "submitted":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          Complaints Management
        </h1>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-6 bg-white rounded-xl border shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search complaints..."
              className="pl-10 bg-gray-50 border-gray-200"
            />
          </div>
          <Button variant="outline" className="flex items-center space-x-2">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </Button>
        </div>
      </Card>

      {/* Complaints Table */}
      <Card className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-pulse">Loading complaints...</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            <p>{error}</p>
            <Button onClick={fetchReports} className="mt-2">
              Retry
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold text-gray-900">
                  Complaint ID
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Title
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Location
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Category
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Priority
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Date
                </TableHead>
                <TableHead className="font-semibold text-gray-900">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {complaints.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-gray-500"
                  >
                    No complaints found
                  </TableCell>
                </TableRow>
              ) : (
                complaints.map((complaint) => (
                  <TableRow key={complaint.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-blue-600">
                      #{complaint.id}
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">
                      {complaint.title}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {complaint.location}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {complaint.category.replace("_", " ")}
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(complaint.severity)}>
                        {complaint.severity
                          .replace("_", " ")
                          .charAt(0)
                          .toUpperCase() +
                          complaint.severity.replace("_", " ").slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(complaint.status)}>
                        {complaint.status
                          .replace("_", " ")
                          .charAt(0)
                          .toUpperCase() +
                          complaint.status.replace("_", " ").slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {new Date(complaint.submittedDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onViewComplaint(complaint)}
                        className="flex items-center space-x-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
