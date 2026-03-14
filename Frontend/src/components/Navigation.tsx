import { Button } from "./ui/button";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const navItems = [
    { id: "home", label: "Home" },
    { id: "map", label: "Map" },
    { id: "complaints", label: "Complaints" },
    { id: "chatbot", label: "Chatbot" },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="text-xl font-medium text-gray-800">JGMD</div>

      <div className="flex items-center space-x-2">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "default" : "ghost"}
            onClick={() => onTabChange(item.id)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === item.id
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
            }`}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </nav>
  );
}
