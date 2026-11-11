import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, Button, FlatList, Image, Keyboard, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { BASE_URL } from "../config.js";

class ApiError extends Error {
  constructor(message, status = null) {
    super(message);
    this.status = status;
  }
}

// Handles both FastAPI string errors and its list of validation errors.
function errorDetail(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => {
      const field = (item.loc || []).filter((part) => part !== "body").join(".");
      return `${field || "Request"}: ${item.msg || "Invalid value"}`;
    }).join("\n");
  }
  return "Request failed.";
}

async function request(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${BASE_URL.replace(/\/+$/, "")}${path}`, {
      signal: controller.signal,
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) {
      const fallback = {
        404: "Robots not found.",
        500: "Internal server error.",
        503: "Database service unavailable. Try again later.",
      }[response.status] || "Request failed.";
      throw new ApiError(
        `HTTP ${response.status}: ${data?.detail ? errorDetail(data.detail) : fallback}`,
        response.status
      );
    }
    if (data === null) throw new ApiError("Server returned an empty or invalid JSON response.");
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === "AbortError") throw new ApiError("Request timed out. Try again.");
    if (error instanceof TypeError) {
      throw new ApiError("Cannot reach the server. Check your connection and BASE_URL.");
    }
    throw new ApiError(error.message || "Unexpected error.");
  } finally {
    clearTimeout(timer);
  }
}

function Thumb({ url }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={s.thumbBox}>
      {!!url && !failed ? (
        <Image source={{ uri: url }} style={s.fill} resizeMode="contain" onError={() => setFailed(true)} />
      ) : (
        <Text style={s.thumbText}>No image</Text>
      )}
    </View>
  );
}

function BigImage({ url }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={s.bigBox}>
      {!!url && !failed ? (
        <Image source={{ uri: url }} style={s.fill} resizeMode="contain" onError={() => setFailed(true)} />
      ) : (
        <Text style={s.bigText}>Image not available</Text>
      )}
    </View>
  );
}

export default function Search() {
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const loadRobots = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await request("/robots");
      if (!Array.isArray(data)) throw new ApiError("Server did not return a robot list.");
      setRobots(data.filter((robot) => typeof robot?._id === "string"));
    } catch (error) {
      setRobots([]);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload every time the screen is opened so new or deleted robots are reflected.
  useFocusEffect(
    useCallback(() => {
      setSelected(null);
      loadRobots();
    }, [loadRobots])
  );

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const matches = useMemo(() => {
    if (words.length === 0) return [];
    return robots.filter((robot) => {
      const description = String(robot.description ?? "").toLowerCase();
      return words.every((word) => description.includes(word));
    });
  }, [robots, query]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(robot) {
    Keyboard.dismiss();
    setSelected(robot);
  }

  // ---------- Detail view: the list is not rendered at all ----------
  if (selected) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.container}>
        <Button title="← Back to results" onPress={() => setSelected(null)} />
        <BigImage url={selected.imageUrl} />
        <Text style={s.detailName}>{selected.name}</Text>
        <Text style={s.detailPrice}>${selected.price}</Text>
        <Text style={s.detailLabel}>Description</Text>
        <Text style={s.detailText}>{selected.description}</Text>
        <Text style={s.detailLabel}>Image URL</Text>
        <Text style={s.detailUrl} selectable>{selected.imageUrl}</Text>
        <Text style={s.detailLabel}>ID</Text>
        <Text style={s.detailUrl} selectable>{selected._id}</Text>
      </ScrollView>
    );
  }

  // ---------- Search view ----------
  let status = null;
  if (!loading && !loadError) {
    if (robots.length === 0) status = "There are no robots in the database yet.";
    else if (words.length === 0) status = "Type part of a description to search.";
    else if (matches.length === 0) status = `No robot description contains "${query.trim()}".`;
  }

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
      data={matches}
      keyExtractor={(item) => item._id}
      ListHeaderComponent={
        <View>
          <Text style={s.title}>Search Robot</Text>
          <Text style={s.label}>Part of the description</Text>
          <TextInput
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. description of Robot"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            returnKeyType="search"
          />
          {loading && <ActivityIndicator style={s.spacing} size="large" />}
          {!!loadError && (
            <View style={s.errorBox}>
              <Text style={s.error}>{loadError}</Text>
              <Button title="Retry" onPress={loadRobots} />
            </View>
          )}
          {!!status && <Text style={s.status}>{status}</Text>}
          {matches.length > 0 && (
            <Text style={s.count}>
              {matches.length} {matches.length === 1 ? "robot" : "robots"} found. Tap one to see it.
            </Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={s.card} onPress={() => choose(item)} activeOpacity={0.7}>
          <Thumb url={item.imageUrl} />
          <View style={s.flex}>
            <Text style={s.name}>{item.name}</Text>
            <Text>${item.price}</Text>
            <Text numberOfLines={2}>{item.description}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: "#fff" },
  container: { padding: 20, paddingBottom: 48 },
  flex: { flex: 1 },
  fill: { width: "100%", height: "100%" },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 20 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#888", borderRadius: 8, padding: 12,
    marginBottom: 12, fontSize: 16, color: "#111", backgroundColor: "#fff",
  },
  spacing: { marginVertical: 12 },
  errorBox: { marginBottom: 16 },
  error: { color: "#b00020", marginBottom: 8 },
  status: { color: "#555", marginTop: 4 },
  count: { color: "#555", marginBottom: 12 },
  card: {
    flexDirection: "row", alignItems: "center", padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, backgroundColor: "#fff",
  },
  name: { fontSize: 16, fontWeight: "700" },
  thumbBox: {
    width: 56, height: 56, marginRight: 12, borderWidth: 1, borderColor: "#888",
    borderRadius: 8, alignItems: "center", justifyContent: "center",
    overflow: "hidden", backgroundColor: "#f4f4f4",
  },
  thumbText: { fontSize: 9, color: "#666", textAlign: "center" },
  bigBox: {
    width: "100%", aspectRatio: 1, marginVertical: 16, borderWidth: 1,
    borderColor: "#ccc", borderRadius: 12, alignItems: "center",
    justifyContent: "center", overflow: "hidden", backgroundColor: "#f4f4f4",
  },
  bigText: { color: "#666", fontSize: 16 },
  detailName: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  detailPrice: { fontSize: 22, color: "#176434", fontWeight: "600", marginBottom: 16 },
  detailLabel: { fontSize: 14, fontWeight: "700", color: "#555", marginTop: 12, marginBottom: 2 },
  detailText: { fontSize: 18, lineHeight: 26 },
  detailUrl: { fontSize: 14, color: "#333" },
});