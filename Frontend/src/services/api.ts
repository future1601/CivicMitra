// API service for connecting to the backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export interface Report {
  report_id: string;
  session_id: string;
  citizen_phone: string;
  description: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  image_path?: string;
  category: string;
  priority: "low" | "medium" | "high" | "very_high";
  department: string;
  resolution_days?: number;
  status: "submitted" | "in_progress" | "resolved";
  location_lat: number;
  location_lon: number;
  address_extracted?: string;
  created_at: string;
  updated_at: string;
}

export interface Location {
  lng: number;
  lat: number;
  name: string;
  info: string;
  // Filter data for marker customization
  category?: string;
  priority?: "low" | "medium" | "high" | "very_high";
  department?: string;
  status?: "submitted" | "in_progress" | "resolved";
  report_id?: string;
  // Additional fields for detailed popup
  description?: string;
  created_at?: string;
  phone_number?: string;
  resolution_days?: number;
}

export interface FilterOptions {
  categories: {
    available: string[];
    all_options: string[];
  };
  priorities: {
    available: string[];
    all_options: string[];
  };
  departments: {
    available: string[];
    all_options: string[];
  };
  statuses: {
    available: string[];
    all_options: string[];
  };
}

export interface StatCard {
  value: number | string;
  change: string;
  change_type: "increase" | "decrease";
}

export interface MonthlyData {
  month: string;
  complaints: number;
}

export interface CategoryData {
  name: string;
  value: number;
  color: string;
}

export interface ComprehensiveStats {
  cards: {
    total_complaints: StatCard;
    resolved_this_month: StatCard;
    pending_review: StatCard;
    avg_resolution_time: StatCard;
  };
  monthly_data: MonthlyData[];
  category_data: CategoryData[];
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_department: Record<string, number>;
  total_reports: number;
}

export interface ReportStats {
  total_reports: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
}

class ApiService {
  private async fetchWithErrorHandling(url: string, options?: RequestInit) {
    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "API request failed");
      }

      return data.data;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  // Get all reports
  async getAllReports(): Promise<Report[]> {
    return this.fetchWithErrorHandling(`${API_BASE_URL}/reports`);
  }

  // Get report statistics
  async getReportStats(): Promise<ReportStats> {
    return this.fetchWithErrorHandling(`${API_BASE_URL}/reports/stats`);
  }

  // Get comprehensive statistics for dashboard
  async getComprehensiveStats(): Promise<ComprehensiveStats> {
    return this.fetchWithErrorHandling(`${API_BASE_URL}/reports/stats`);
  }

  // Get reports by location for map with optional filters
  async getReportsByLocation(filters?: {
    category?: string;
    priority?: string;
    department?: string;
    status?: string;
  }): Promise<Location[]> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filters?.category) params.append("category", filters.category);
      if (filters?.priority) params.append("priority", filters.priority);
      if (filters?.department) params.append("department", filters.department);
      if (filters?.status) params.append("status", filters.status);

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const url = `${API_BASE_URL}/reports/by-location${queryString}`;

      console.log("Fetching reports from:", url);
      const data = await this.fetchWithErrorHandling(url);
      console.log("Raw API response:", data);

      // Ensure the data is an array
      if (!Array.isArray(data)) {
        console.warn("Expected array, got:", typeof data, data);
        return [];
      }

      return data;
    } catch (error) {
      console.error("Error fetching reports by location:", error);
      return [];
    }
  }

  // Get available filter options
  async getFilterOptions(): Promise<FilterOptions> {
    return this.fetchWithErrorHandling(`${API_BASE_URL}/filter-options`);
  }

  // Get specific report details
  async getReportDetails(reportId: string): Promise<Report> {
    return this.fetchWithErrorHandling(`${API_BASE_URL}/reports/${reportId}`);
  }

  // Check if backend is connected
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL.replace("/api", "")}/health`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // Chatbot API methods
  async sendChatMessage(
    message: string,
    chatHistory: any[] = []
  ): Promise<{ response: string; status: string }> {
    const response = await fetch(`${API_BASE_URL}/chatbot/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        chat_history: chatHistory,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getChatbotStats(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/chatbot/stats`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}

export const apiService = new ApiService();
