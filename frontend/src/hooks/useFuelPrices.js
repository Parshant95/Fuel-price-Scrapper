// frontend/src/hooks/useFuelPrices.js
import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

export function useFuelPrices() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchPrices = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/prices/latest`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPrices(json.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return { prices, loading, error, lastUpdated, refetch: fetchPrices };
}

export function useStatePrice(stateName) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!stateName) return;

    async function fetch_() {
      try {
        const res = await fetch(`${API_BASE}/prices/${encodeURIComponent(stateName)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetch_();
  }, [stateName]);

  return { data, loading, error };
}

export function useStateHistory(stateName, days = 30) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!stateName) return;

    async function fetch_() {
      try {
        const res = await fetch(
          `${API_BASE}/prices/${encodeURIComponent(stateName)}/history?days=${days}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setHistory(json.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetch_();
  }, [stateName, days]);

  return { history, loading, error };
}
