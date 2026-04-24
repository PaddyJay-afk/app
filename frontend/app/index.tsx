import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const SAMPLE_WINDOW_HOURS = 4;
const REFRESH_MS = 60_000;

type Telemetry = {
  captured_at: string;
  location: { lat: number; lon: number };
  weather: {
    temperature_c: number | null;
    pressure_hpa: number | null;
    wind_speed_kph: number | null;
    wind_direction_deg: number | null;
    humidity_pct: number | null;
    cloud_cover_pct: number | null;
    uv_index: number | null;
  };
  space_weather: {
    kp_index: number | null;
    solar_wind_speed_km_s: number | null;
    solar_wind_density_p_cm3: number | null;
    interplanetary_bt_nt: number | null;
    interplanetary_bz_nt: number | null;
  };
  experimental: {
    estimated_cloud_potential_kv: number | null;
    dusty_plasma_index: number | null;
  };
};

type Sample = {
  t: number;
  telemetry: Telemetry;
};

const COLORS = {
  bg: '#06070D',
  card: '#101323',
  border: '#252B47',
  red: '#FF5C7A',
  blue: '#58B7FF',
  purple: '#BD8BFF',
  green: '#63F5A6',
  text: '#F2F5FF',
  muted: '#97A5CF',
};

const fmt = (v: number | null | undefined, digits = 1) => (typeof v === 'number' ? v.toFixed(digits) : '—');

const miniBars = (values: number[], color: string) => {
  if (values.length === 0) {
    return <Text style={[styles.muted, { marginTop: 10 }]}>Collecting trend...</Text>;
  }
  const max = Math.max(...values, 1);
  return (
    <View style={styles.sparkRow}>
      {values.slice(-20).map((v, i) => (
        <View
          key={i}
          style={[
            styles.sparkBar,
            {
              backgroundColor: color,
              height: Math.max(4, (v / max) * 36),
            },
          ]}
        />
      ))}
    </View>
  );
};

export default function UAPTelemetryDashboard() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTelemetry = useCallback(async () => {
    if (!API_BASE_URL) {
      setError('Missing EXPO_PUBLIC_BACKEND_URL.');
      return;
    }

    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/uap/telemetry`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Telemetry = await res.json();
      const now = Date.now();
      const oldest = now - SAMPLE_WINDOW_HOURS * 60 * 60 * 1000;

      setSamples((prev) => [...prev, { t: now, telemetry: data }].filter((s) => s.t >= oldest));
    } catch (e) {
      setError(`Telemetry fetch failed: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    const id = setInterval(fetchTelemetry, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchTelemetry]);

  const latest = samples[samples.length - 1]?.telemetry;

  const trends = useMemo(() => {
    return {
      temp: samples.map((s) => s.telemetry.weather.temperature_c ?? 0),
      pressure: samples.map((s) => s.telemetry.weather.pressure_hpa ?? 0),
      kp: samples.map((s) => s.telemetry.space_weather.kp_index ?? 0),
      plasma: samples.map((s) => s.telemetry.experimental.dusty_plasma_index ?? 0),
    };
  }, [samples]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTelemetry();
    setRefreshing(false);
  }, [fetchTelemetry]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
      >
        <Text style={styles.header}>UAP Night Watch Telemetry</Text>
        <Text style={styles.subheader}>4-hour rolling capture · refreshes every minute · iPhone portrait layout</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.grid}>
          <View style={[styles.card, { borderColor: COLORS.red }]}>
            <Text style={[styles.cardTitle, { color: COLORS.red }]}>Atmosphere</Text>
            <Text style={styles.metric}>Temp: {fmt(latest?.weather.temperature_c)}°C</Text>
            <Text style={styles.metric}>Pressure: {fmt(latest?.weather.pressure_hpa)} hPa</Text>
            <Text style={styles.metric}>Humidity: {fmt(latest?.weather.humidity_pct)}%</Text>
            <Text style={styles.metric}>Cloud cover: {fmt(latest?.weather.cloud_cover_pct)}%</Text>
            {miniBars(trends.temp, COLORS.red)}
          </View>

          <View style={[styles.card, { borderColor: COLORS.blue }]}>
            <Text style={[styles.cardTitle, { color: COLORS.blue }]}>Wind + UV</Text>
            <Text style={styles.metric}>Wind speed: {fmt(latest?.weather.wind_speed_kph)} km/h</Text>
            <Text style={styles.metric}>Wind dir: {fmt(latest?.weather.wind_direction_deg, 0)}°</Text>
            <Text style={styles.metric}>UV index: {fmt(latest?.weather.uv_index)}</Text>
            <Text style={styles.metric}>Cloud kV est.: {fmt(latest?.experimental.estimated_cloud_potential_kv)} kV</Text>
            {miniBars(trends.pressure, COLORS.blue)}
          </View>

          <View style={[styles.card, { borderColor: COLORS.purple }]}>
            <Text style={[styles.cardTitle, { color: COLORS.purple }]}>NOAA Space Weather</Text>
            <Text style={styles.metric}>Kp index: {fmt(latest?.space_weather.kp_index)}</Text>
            <Text style={styles.metric}>IMF Bt: {fmt(latest?.space_weather.interplanetary_bt_nt)} nT</Text>
            <Text style={styles.metric}>IMF Bz: {fmt(latest?.space_weather.interplanetary_bz_nt)} nT</Text>
            <Text style={styles.metric}>Solar wind: {fmt(latest?.space_weather.solar_wind_speed_km_s)} km/s</Text>
            {miniBars(trends.kp, COLORS.purple)}
          </View>

          <View style={[styles.card, { borderColor: COLORS.green }]}>
            <Text style={[styles.cardTitle, { color: COLORS.green }]}>Dusty Plasma Signals</Text>
            <Text style={styles.metric}>Plasma density: {fmt(latest?.space_weather.solar_wind_density_p_cm3)} p/cm³</Text>
            <Text style={styles.metric}>Dusty plasma idx: {fmt(latest?.experimental.dusty_plasma_index)}</Text>
            <Text style={styles.metric}>Samples stored: {samples.length}</Text>
            <Text style={styles.metric}>Window: {SAMPLE_WINDOW_HOURS} hr</Text>
            {miniBars(trends.plasma, COLORS.green)}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 12, paddingBottom: 30, backgroundColor: COLORS.bg },
  header: { color: COLORS.text, fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subheader: { color: COLORS.muted, fontSize: 13, marginBottom: 12 },
  error: { color: COLORS.red, marginBottom: 10, fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  card: {
    width: '48%',
    minHeight: 240,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  metric: { color: COLORS.text, fontSize: 14, marginBottom: 4, fontWeight: '600' },
  muted: { color: COLORS.muted, fontSize: 12 },
  sparkRow: {
    marginTop: 8,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  sparkBar: {
    width: 4,
    borderRadius: 3,
    opacity: 0.95,
  },
});
