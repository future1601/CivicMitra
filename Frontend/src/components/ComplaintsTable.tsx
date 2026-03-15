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
  severity: "low" | "medium" | "high" | "very_high";
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

  const formatDisplayDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value || "Unknown date";
    }
    return parsed.toLocaleDateString();
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
    severity: report.priority as "low" | "medium" | "high" | "very_high",
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
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white/92 p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)] lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Case Queue
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Review and manage complaints
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            Search complaint records, inspect priorities, and open case details
            from a cleaner review table.
          </p>
        </div>
        <Button className="rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800">
          Export Report
        </Button>
      </div>

      <Card className="rounded-[24px] border-slate-200 bg-white/94 p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
            <Input
              placeholder="Search complaints..."
              className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10"
            />
          </div>
          <Button
            variant="outline"
            className="h-11 rounded-xl border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50"
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white/94 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
        {loading ? (
          <div className="p-8 text-center text-slate-600">
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
              <TableRow className="bg-slate-50/90">
                <TableHead className="font-semibold text-slate-900">
                  Complaint ID
                </TableHead>
                <TableHead className="font-semibold text-slate-900">
                  Title
                </TableHead>
                <TableHead className="font-semibold text-slate-900">
                  Location
                </TableHead>
                <TableHead className="font-semibold text-slate-900">
                  Category
                </TableHead>
                <TableHead className="font-semibold text-slate-900">
                  Priority
                </TableHead>
                <TableHead className="font-semibold text-slate-900">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-slate-900">
                  Date
                </TableHead>
                <TableHead className="font-semibold text-slate-900">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {complaints.length === 0 ? (
                <TableRow>
                  <TableCell
                  colSpan={8}
                    className="py-8 text-center text-slate-500"
                  >
                    No complaints found
                  </TableCell>
                </TableRow>
              ) : (
                complaints.map((complaint) => (
                  <TableRow
                    key={complaint.id}
                    className="border-slate-100 hover:bg-slate-50/70"
                  >
                    <TableCell className="font-medium text-sky-700">
                      #{complaint.id}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {complaint.title}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {complaint.location}
                    </TableCell>
                    <TableCell className="text-slate-600">
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
                    <TableCell className="text-slate-600">
                      {formatDisplayDate(complaint.submittedDate)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onViewComplaint(complaint)}
                        className="rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
