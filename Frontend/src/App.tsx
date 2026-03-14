import { useState } from "react";
import { Navigation } from "./components/Navigation";
import JharkhandHeatmap from "./components/JharkhandHeatmap";
import { StatisticsSection } from "./components/StatisticsSection";
import { ComplaintDetails } from "./components/ComplaintDetails";
import { ComplaintsTable } from "./components/ComplaintsTable";
import { ChatbotPage } from "./components/ChatbotPage";

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

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(
    null
  );

  const handleComplaintClick = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
  };

  const handleBackToDashboard = () => {
    setSelectedComplaint(null);
    setActiveTab("home");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedComplaint(null); // Clear selected complaint when switching tabs
  };

  const renderContent = () => {
    // Show complaint details if a complaint is selected
    if (selectedComplaint) {
      return (
        <ComplaintDetails
          complaint={selectedComplaint}
          onBack={handleBackToDashboard}
        />
      );
    }

    // Show content based on active tab
    switch (activeTab) {
      case "home":
        return (
          <div className="space-y-8">
            {/* Main Dashboard Header */}
            <div className="text-center py-8">
              <h1 className="text-3xl font-semibold text-gray-900 mb-2">
                Jharkhand Grievance Management Dashboard
              </h1>
              <p className="text-gray-600">
                Monitor and manage citizen complaints across Jharkhand state
              </p>
            </div>

            {/* Jharkhand Heatmap */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Complaint Density Heatmap
              </h2>
              <JharkhandHeatmap onComplaintClick={handleComplaintClick} />
            </div>

            {/* Statistics Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Statistics & Analytics
              </h2>
              <StatisticsSection />
            </div>
          </div>
        );

      case "map":
        return (
          <div className="space-y-6">
            <div className="text-center py-4">
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Jharkhand Interactive Map
              </h1>
              <p className="text-gray-600">
                Detailed view of complaint distribution across the state
              </p>
            </div>
            <JharkhandHeatmap onComplaintClick={handleComplaintClick} />
          </div>
        );

      case "complaints":
        return <ComplaintsTable onViewComplaint={handleComplaintClick} />;

      case "chatbot":
        return <ChatbotPage />;

      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="container mx-auto px-6 py-8">{renderContent()}</main>
    </div>
  );
}
