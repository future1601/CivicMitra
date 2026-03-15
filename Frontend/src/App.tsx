import { useState } from "react";
import {
  ArrowRight,
  Bot,
  ClipboardList,
  MapPinned,
  PhoneCall,
} from "lucide-react";
import { Navigation } from "./components/Navigation";
import Heatmap from "./components/Heatmap";
import { StatisticsSection } from "./components/StatisticsSection";
import { ComplaintDetails } from "./components/ComplaintDetails";
import { ComplaintsTable } from "./components/ComplaintsTable";
import { ChatbotPage } from "./components/ChatbotPage";
import { CallingConsolePage } from "./components/CallingConsolePage";
import { Button } from "./components/ui/button";

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

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-head">
      <div>
        <p className="section-eyebrow">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
      </div>
      <p className="section-head__copy">{description}</p>
    </div>
  );
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
    setSelectedComplaint(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderHome = () => (
    <div className="page-stack">
      <section className="surface-panel page-masthead">
        <div className="page-masthead__copy">
          <p className="section-eyebrow">Administrative Dashboard</p>
          <h1 className="page-title">Grievance Management Dashboard</h1>
          <p className="page-copy">
            Monitor complaint traffic, review geographic activity, and move
            field reports through departmental workflows from one cleaner
            control surface.
          </p>
        </div>

        <div className="page-masthead__actions">
          <Button
            onClick={() => handleTabChange("complaints")}
            className="rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800"
          >
            Open complaint queue
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => handleTabChange("chatbot")}
            className="rounded-full border-slate-300 px-5 text-slate-700 hover:bg-slate-50"
          >
            Open assistant
          </Button>
        </div>
      </section>

      <section className="quick-grid">
        <div className="quick-card">
          <div className="quick-card__icon">
            <MapPinned className="h-5 w-5" />
          </div>
          <div>
            <h3 className="quick-card__title">Live map monitoring</h3>
            <p className="quick-card__text">
              Review complaint markers, filters, and location-specific details
              from the same workspace.
            </p>
          </div>
        </div>

        <div className="quick-card">
          <div className="quick-card__icon">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h3 className="quick-card__title">Complaint review queue</h3>
            <p className="quick-card__text">
              Move from incoming records to action faster with a clearer case
              management surface.
            </p>
          </div>
        </div>

        <div className="quick-card">
          <div className="quick-card__icon">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="quick-card__title">Assistant support</h3>
            <p className="quick-card__text">
              Ask for complaint summaries, status counts, and quick operational
              lookups without leaving the desk.
            </p>
          </div>
        </div>

        <div className="quick-card">
          <div className="quick-card__icon">
            <PhoneCall className="h-5 w-5" />
          </div>
          <div>
            <h3 className="quick-card__title">Emergency call console</h3>
            <p className="quick-card__text">
              Monitor the Twilio calling service, expose the detector endpoint,
              and manually trigger broadcast alerts from the dashboard.
            </p>
          </div>
        </div>
      </section>

      <section className="surface-panel surface-panel--padded">
        <SectionHeader
          eyebrow="Live Monitoring"
          title="Complaint density map"
          description="The map stays central to the dashboard so operators can review field activity, filter by department or priority, and inspect complaint details in context."
        />
        <Heatmap onComplaintClick={handleComplaintClick} />
      </section>

      <section className="surface-panel surface-panel--padded">
        <SectionHeader
          eyebrow="Resolution Intelligence"
          title="Statistics and workload signals"
          description="Track complaint throughput, review trends, and monitor department-level distribution from a cleaner analytics section."
        />
        <StatisticsSection />
      </section>

    </div>
  );

  const renderContent = () => {
    if (selectedComplaint) {
      return (
        <ComplaintDetails
          complaint={selectedComplaint}
          onBack={handleBackToDashboard}
        />
      );
    }

    switch (activeTab) {
      case "home":
        return renderHome();

      case "map":
        return (
          <div className="page-stack">
            <section className="surface-panel page-masthead">
              <div className="page-masthead__copy">
                <p className="section-eyebrow">Geographic Monitoring</p>
                <h1 className="page-title">Interactive complaint map</h1>
                <p className="page-copy">
                  Review location clusters, complaint filters, and linked case
                  information without switching away from the operations view.
                </p>
              </div>
            </section>

            <section className="surface-panel surface-panel--padded">
              <Heatmap onComplaintClick={handleComplaintClick} />
            </section>
          </div>
        );

      case "complaints":
        return (
          <div className="page-stack">
            <section className="surface-panel page-masthead">
              <div className="page-masthead__copy">
                <p className="section-eyebrow">Complaint Review</p>
                <h1 className="page-title">Complaints management</h1>
                <p className="page-copy">
                  Review incoming records, inspect priority and status, and open
                  detailed complaint files from one cleaner administrative grid.
                </p>
              </div>
            </section>

            <ComplaintsTable onViewComplaint={handleComplaintClick} />
          </div>
        );

      case "chatbot":
        return (
          <div className="page-stack">
            <section className="surface-panel page-masthead">
              <div className="page-masthead__copy">
                <p className="section-eyebrow">Assistant Console</p>
                <h1 className="page-title">Complaint data assistant</h1>
                <p className="page-copy">
                  Use the assistant for database lookups, complaint summaries,
                  and quick operational questions during case review.
                </p>
              </div>
            </section>

            <ChatbotPage />
          </div>
        );

      case "calls":
        return (
          <div className="page-stack">
            <section className="surface-panel page-masthead">
              <div className="page-masthead__copy">
                <p className="section-eyebrow">Emergency Broadcast</p>
                <h1 className="page-title">Calling service console</h1>
                <p className="page-copy">
                  Monitor the FastAPI calling service, share the detector-facing
                  broadcast endpoint, and trigger Twilio alert calls from the
                  admin dashboard.
                </p>
              </div>
            </section>

            <CallingConsolePage />
          </div>
        );

      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="app-shell">
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="app-main">{renderContent()}</main>
    </div>
  );
}
