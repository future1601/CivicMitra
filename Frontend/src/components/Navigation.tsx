import {
  Bot,
  ClipboardList,
  Home,
  MapPinned,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui/button";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "map", label: "Map", icon: MapPinned },
    { id: "complaints", label: "Complaints", icon: ClipboardList },
    { id: "calls", label: "Calls", icon: PhoneCall },
    { id: "chatbot", label: "Chatbot", icon: Bot },
  ];

  return (
    <header className="admin-topbar">
      <div className="admin-topbar__inner">
        <div className="admin-brand">
          <div className="admin-brand__mark">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <div>
            <p className="admin-brand__eyebrow">Civic Mitra</p>
            <h1 className="admin-brand__title">Administrative Grievance Console</h1>
            <p className="admin-brand__subtitle">
              Monitoring, review, and resolution workspace
            </p>
          </div>
        </div>

        <div className="admin-topbar__right">
          <div className="status-pill">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            Government Workspace
          </div>

          <nav className="admin-tablist">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => onTabChange(item.id)}
                  className={`admin-tab ${
                    activeTab === item.id ? "admin-tab--active" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
