import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { apiService, ComprehensiveStats } from "../services/api";

export function StatisticsSection() {
  const [stats, setStats] = useState<ComprehensiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await apiService.getComprehensiveStats();
        setStats(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch statistics:", err);
        setError("Failed to load statistics");
        // Fallback to mock data
        setStats({
          cards: {
            total_complaints: {
              value: 0,
              change: "+0%",
              change_type: "increase",
            },
            resolved_this_month: {
              value: 0,
              change: "+0%",
              change_type: "increase",
            },
            pending_review: {
              value: 0,
              change: "-0%",
              change_type: "decrease",
            },
            avg_resolution_time: {
              value: "0.0 days",
              change: "-0%",
              change_type: "decrease",
            },
          },
          monthly_data: [
            { month: "Jan", complaints: 0 },
            { month: "Feb", complaints: 0 },
            { month: "Mar", complaints: 0 },
            { month: "Apr", complaints: 0 },
            { month: "May", complaints: 0 },
            { month: "Jun", complaints: 0 },
          ],
          category_data: [{ name: "No Data", value: 100, color: "#3B82F6" }],
          by_status: {},
          by_priority: {},
          by_department: {},
          total_reports: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6 bg-white rounded-xl border shadow-sm">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading statistics: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const statsCards = [
    {
      title: "Total Complaints",
      value: stats.cards.total_complaints.value.toString(),
      change: stats.cards.total_complaints.change,
      changeType: stats.cards.total_complaints.change_type,
    },
    {
      title: "Resolved This Month",
      value: stats.cards.resolved_this_month.value.toString(),
      change: stats.cards.resolved_this_month.change,
      changeType: stats.cards.resolved_this_month.change_type,
    },
    {
      title: "Pending Review",
      value: stats.cards.pending_review.value.toString(),
      change: stats.cards.pending_review.change,
      changeType: stats.cards.pending_review.change_type,
    },
    {
      title: "Average Resolution Time",
      value: stats.cards.avg_resolution_time.value.toString(),
      change: stats.cards.avg_resolution_time.change,
      changeType: stats.cards.avg_resolution_time.change_type,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Key Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => (
          <Card
            key={index}
            className="p-6 bg-white rounded-xl border shadow-sm"
          >
            <div className="space-y-2">
              <div className="text-sm text-gray-600">{stat.title}</div>
              <div className="text-2xl font-semibold text-gray-900">
                {stat.value}
              </div>
              <div
                className={`text-sm flex items-center ${
                  stat.changeType === "increase"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                <span className="mr-1">
                  {stat.changeType === "increase" ? "↑" : "↓"}
                </span>
                {stat.change} from last month
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Complaints Chart */}
        <Card className="p-6 bg-white rounded-xl border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Monthly Complaints
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.monthly_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="complaints" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Complaint Categories Chart */}
        <Card className="p-6 bg-white rounded-xl border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Complaints by Department
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats.category_data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {stats.category_data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {stats.category_data.map((category, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  ></div>
                  <span className="text-gray-700">{category.name}</span>
                </div>
                <span className="text-gray-600">{category.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
