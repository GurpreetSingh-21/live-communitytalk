"use client";

import { useEffect } from "react";
import axios from "axios";

const KeepAlive = () => {
  useEffect(() => {
    const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

    const ping = async () => {
      try {
        const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!baseURL) return;

        // Use the health endpoint
        await axios.get(`${baseURL}/health`);
        console.log("💓 [KeepAlive] Ping sent to backend");
      } catch (error) {
        // Silent fail - we don't want to disturb the user
        console.warn("💓 [KeepAlive] Ping failed", error);
      }
    };

    // Initial ping
    ping();

    const interval = setInterval(ping, PING_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return null; // Component renders nothing
};

export default KeepAlive;
