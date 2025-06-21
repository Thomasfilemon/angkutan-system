// components/Timeline.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

const TIMELINE_CONFIG = [
  { key: "created_at", label: "DO Created" },
  { key: "departed_to_load_location_at", label: "Berangkat ke Lokasi Muat" },
  { key: "arrived_at_load_location_at", label: "Tiba di Lokasi Muat" },
  {
    key: "departed_from_load_location_at",
    label: "Berangkat ke Lokasi Bongkar",
  },
  { key: "arrived_at_unload_location_at", label: "Tiba di Lokasi Bongkar" },
  {
    key: "departed_from_unload_location_at",
    label: "Berangkat Kembali ke Pool",
  },
  { key: "completed_at", label: "Selesai" },
];

type TimelineData = {
  [key: string]: string | number | Date | undefined;
};

interface TimelineProps {
  data: TimelineData;
}

export default function Timeline({ data }: TimelineProps) {
  return (
    <View style={styles.timeline}>
      {TIMELINE_CONFIG.map(({ key, label }) => {
        const value = data[key];
        if (!value) return null;
        return (
          <View key={key} style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>{label}</Text>
            <Text style={styles.timelineValue}>
              {new Date(value).toLocaleString("id-ID")}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { marginTop: 8 },
  timelineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  timelineLabel: { color: "#6b7280", fontSize: 14 },
  timelineValue: { color: "#1f2937", fontSize: 14, fontWeight: "bold" },
});
