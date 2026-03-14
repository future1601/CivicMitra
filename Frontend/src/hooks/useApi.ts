import { useState, useEffect } from "react";
import { apiService, Report, ReportStats } from "../services/api";

// Hook for fetching all reports
export const useReports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getAllReports();
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return { reports, loading, error, refetch: fetchReports };
};

// Hook for fetching report statistics
export const useReportStats = () => {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getReportStats();
      setStats(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch statistics"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, error, refetch: fetchStats };
};

// Hook for checking backend connection
export const useBackendConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkConnection = async () => {
    try {
      setChecking(true);
      const connected = await apiService.checkConnection();
      setIsConnected(connected);
    } catch {
      setIsConnected(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();

    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 60000);
    return () => clearInterval(interval);
  }, []);

  return { isConnected, checking, checkConnection };
};
