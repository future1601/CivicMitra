import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { ArrowLeft, Calendar, MapPin, User } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

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

interface ComplaintDetailsProps {
  complaint: Complaint;
  onBack: () => void;
}

export function ComplaintDetails({ complaint, onBack }: ComplaintDetailsProps) {
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

  const aiSuggestions = [
    "Assign to Municipal Water Department for immediate inspection",
    "Schedule emergency water tanker deployment to affected areas",
    "Create task for pipeline repair team with high priority",
    "Notify local councilor for community communication",
    "Set up temporary water distribution point",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Button>
      </div>

      {/* Complaint Header Info */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">
              {complaint.title}
            </h1>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <MapPin className="w-4 h-4" />
                <span>{complaint.location}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{complaint.submittedDate || "June 15, 2024"}</span>
              </div>
              <div className="flex items-center space-x-1">
                <User className="w-4 h-4" />
                <span>{complaint.submittedBy || "Anonymous User"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getSeverityColor(complaint.severity)}>
              {complaint.severity.replace("_", " ").charAt(0).toUpperCase() +
                complaint.severity.replace("_", " ").slice(1)}{" "}
              Priority
            </Badge>
            <Badge
              variant="outline"
              className="border-blue-200 text-blue-800 bg-blue-50"
            >
              {complaint.status
                ? complaint.status.replace("_", " ").charAt(0).toUpperCase() +
                  complaint.status.replace("_", " ").slice(1)
                : "Under Review"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side - Image */}
        <Card className="p-6 bg-white rounded-xl border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Complaint Images
          </h3>
          <div className="space-y-4">
            <div className="aspect-video bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
              {complaint.imagePath ? (
                <ImageWithFallback
                  src={`http://localhost:8000/api/uploads/${complaint.imagePath}`}
                  alt="Complaint evidence"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="text-gray-500 text-center">
                  <div className="text-4xl mb-2">📷</div>
                  <div>No image available</div>
                </div>
              )}
            </div>
            {complaint.imagePath && (
              <div className="text-sm text-gray-600 text-center">
                Evidence image for complaint #{complaint.id}
              </div>
            )}
          </div>
        </Card>

        {/* Right Side - Description and AI Actions */}
        <div className="space-y-6">
          {/* Description */}
          <Card className="p-6 bg-white rounded-xl border shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Description
            </h3>
            <div className="text-gray-700 leading-relaxed">
              {complaint.description ||
                "There has been a severe water shortage in our locality for the past 3 days. The main pipeline seems to be damaged near the community center. Residents are facing difficulty in accessing clean drinking water. The issue is affecting approximately 200 households in the area. We request immediate attention to resolve this critical issue as it's affecting daily life activities including cooking, cleaning, and basic hygiene needs."}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <strong>Category:</strong>{" "}
                {complaint.category
                  ? complaint.category
                      .replace("_", " ")
                      .charAt(0)
                      .toUpperCase() +
                    complaint.category.replace("_", " ").slice(1)
                  : "General"}
              </div>
            </div>
          </Card>

          {/* AI Suggested Actions */}
          <Card className="p-6 bg-white rounded-xl border shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              AI-Suggested Actions
            </h3>
            <div className="space-y-3">
              {aiSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200"
                >
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                    {index + 1}
                  </div>
                  <div className="flex-1 text-sm text-gray-700">
                    {suggestion}
                  </div>
                  <Button size="sm" variant="outline" className="text-xs">
                    Apply
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Assign to Department
                </Button>
                <Button variant="outline">Mark as Resolved</Button>
                <Button variant="outline">Request More Info</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
