"use client";

type NetworkInfo = {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
};

type QualityRecommendation = {
  quality: string;
  label: string;
};

export function getNetworkInfo(): NetworkInfo | null {
  if (typeof navigator === "undefined") return null;

  const connection =
    (navigator as unknown as { connection?: NetworkInfo }).connection ||
    (navigator as unknown as { mozConnection?: NetworkInfo }).mozConnection ||
    (navigator as unknown as { webkitConnection?: NetworkInfo }).webkitConnection;

  if (!connection) return null;

  return {
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData,
  };
}

export function getRecommendedQuality(settings?: Record<string, string>): QualityRecommendation {
  const network = getNetworkInfo();

  if (!network) {
    return { quality: "1080p", label: "HD" };
  }

  if (network.saveData) {
    return { quality: "480p", label: "Data Saver" };
  }

  const wifiThreshold = settings?.network_threshold_wifi || "4k";
  const fourGThreshold = settings?.network_threshold_4g || "1080p";
  const threeGThreshold = settings?.network_threshold_3g || "720p";

  switch (network.effectiveType) {
    case "4g":
      return network.downlink >= 10
        ? { quality: wifiThreshold, label: wifiThreshold.toUpperCase() }
        : { quality: fourGThreshold, label: fourGThreshold.toUpperCase() };
    case "3g":
      return { quality: threeGThreshold, label: threeGThreshold.toUpperCase() };
    case "2g":
    case "slow-2g":
      return { quality: "480p", label: "480p" };
    default:
      return { quality: "1080p", label: "HD" };
  }
}
