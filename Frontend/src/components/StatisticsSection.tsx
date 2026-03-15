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
          category_data: [{ name: "No Data", value: 100, color: "#0f3d63" }],
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card
              key={i}
              className="rounded-[22px] border-slate-200 bg-white/94 p-6 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]"
            >
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-3/4 rounded bg-slate-200"></div>
                <div className="h-8 w-1/2 rounded bg-slate-200"></div>
                <div className="h-4 w-1/3 rounded bg-slate-200"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="py-8 text-center">
        <p className="text-rose-600">Error loading statistics: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card
            key={index}
            className="rounded-[22px] border-slate-200 bg-white/94 p-6 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]"
          >
            <div className="space-y-2">
              <div className="text-sm text-slate-500">{stat.title}</div>
              <div className="text-2xl font-semibold text-slate-900">
                {stat.value}
              </div>
              <div
                className={`text-sm ${
                  stat.changeType === "increase"
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {stat.change} from last month
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-[24px] border-slate-200 bg-white/94 p-6 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Monthly Complaints
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.monthly_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8e0e8" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #dbe3ec",
                  borderRadius: "14px",
                  boxShadow: "0 16px 38px -24px rgba(15,23,42,0.28)",
                }}
              />
              <Bar dataKey="complaints" fill="#0f3d63" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="rounded-[24px] border-slate-200 bg-white/94 p-6 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
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
                  border: "1px solid #dbe3ec",
                  borderRadius: "14px",
                  boxShadow: "0 16px 38px -24px rgba(15,23,42,0.28)",
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
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  ></div>
                  <span className="text-slate-700">{category.name}</span>
                </div>
                <span className="text-slate-500">{category.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
