import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Button, FlatList, Image, StyleSheet, Text, View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { BASE_URL } from "../config.js";

class ApiError extends Error {
  constructor(message, status = null, uncertain = false) {
    super(message);
    this.status = status;       // HTTP status, if the server answered
    this.uncertain = uncertain; // true when we don't know if the server finished the action
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

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(
      `${BASE_URL.replace(/\/+$/, "")}${path}`,
      { ...options, signal: controller.signal }
    );
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) {
      const fallback = {
        404: "Robot or collection not found.",
        422: "Invalid robot id.",
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
    if (error.name === "AbortError") {
      throw new ApiError("Request timed out. The list was reloaded so you can check whether the robot was deleted.", null, true);
    }
    if (error instanceof TypeError) {
      throw new ApiError("Cannot reach the server. Check your connection and BASE_URL.", null, true);
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
        <Image source={{ uri: url }} style={s.thumb} resizeMode="contain" onError={() => setFailed(true)} />
      ) : (
        <Text style={s.thumbText}>No image</Text>
      )}
    </View>
  );
}

export default function Delete() {
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState(null);
  const lock = useRef(false);

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

  useFocusEffect(
    useCallback(() => {
      setSelected(null);
      setMessage(null);
      loadRobots();
    }, [loadRobots])
  );

  function choose(robot) {
    if (deleting) return;
    setSelected(robot);
    setMessage(null);
  }

  async function confirmDelete() {
    if (lock.current || !selected) return;
    lock.current = true;
    setDeleting(true);
    setMessage(null);
    const target = selected;
    try {
      const result = await request(`/robotse/${encodeURIComponent(target._id)}`, { method: "DELETE" });
      setRobots((previous) => previous.filter((robot) => robot._id !== target._id));
      setSelected(null);
      setMessage({ error: false, text: result.message || "Robot deleted successfully." });
    } catch (error) {
      setMessage({ error: true, text: error.message });
      // 404 means it is already gone; a timeout/network error means we can't be sure.
      // In both cases the list on screen may be stale, so reload it.
      if (error.status === 404 || error.uncertain) {
        setSelected(null);
        await loadRobots();
      }
      // For 422, 500 and 503 keep the selection so the user can retry or cancel.
    } finally {
      lock.current = false;
      setDeleting(false);
    }
  }

  const header = (
    <View>
      <Text style={s.title}>Delete Robot</Text>

      {selected && (
        <View style={s.confirmBox}>
          <Text style={s.confirmTitle}>Delete this robot?</Text>
          <View style={s.row}>
            <Thumb url={selected.imageUrl} />
            <View style={s.flex}>
              <Text style={s.name}>{selected.name}</Text>
              <Text>${selected.price}</Text>
              <Text numberOfLines={3}>{selected.description}</Text>
            </View>
          </View>
          <Text style={s.warning}>This cannot be undone.</Text>
          <View style={s.buttons}>
            <View style={s.flex}>
              <Button
                title={deleting ? "Deleting..." : "Confirm Delete"}
                color="#b00020" onPress={confirmDelete} disabled={deleting}
              />
            </View>
            <View style={s.gap} />
            <View style={s.flex}>
              <Button title="Cancel" onPress={() => setSelected(null)} disabled={deleting} />
            </View>
          </View>
        </View>
      )}

      {deleting && <ActivityIndicator style={s.spacing} size="large" />}

      {!!message && (
        <Text accessibilityLiveRegion="polite" style={[s.notice, message.error ? s.error : s.success]}>
          {message.text}
        </Text>
      )}

      {loading && <ActivityIndicator style={s.spacing} size="large" />}

      {!!loadError && (
        <View style={s.errorBox}>
          <Text style={s.error}>{loadError}</Text>
          <Button title="Retry" onPress={loadRobots} />
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={s.container}
      data={robots}
      keyExtractor={(item) => item._id}
      ListHeaderComponent={header}
      ListEmptyComponent={!loading && !loadError ? <Text style={s.empty}>No robots to delete.</Text> : null}
      extraData={[selected, deleting, message]}
      renderItem={({ item }) => (
        <View style={[s.card, selected?._id === item._id && s.cardSelected]}>
          <Thumb url={item.imageUrl} />
          <View style={s.flex}>
            <Text style={s.name}>{item.name}</Text>
            <Text>${item.price}</Text>
            <Text numberOfLines={2}>{item.description}</Text>
          </View>
          <Button title="Delete" color="#b00020" onPress={() => choose(item)} disabled={deleting} />
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: "#fff" },
  container: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center" },
  flex: { flex: 1 },
  gap: { width: 12 },
  card: {
    flexDirection: "row", alignItems: "center", padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8, backgroundColor: "#fff",
  },
  cardSelected: { borderColor: "#b00020", backgroundColor: "#fff5f5" },
  name: { fontSize: 16, fontWeight: "700" },
  thumbBox: {
    width: 56, height: 56, marginRight: 12, borderWidth: 1, borderColor: "#888",
    borderRadius: 8, alignItems: "center", justifyContent: "center",
    overflow: "hidden", backgroundColor: "#f4f4f4",
  },
  thumb: { width: "100%", height: "100%" },
  thumbText: { fontSize: 9, color: "#666", textAlign: "center" },
  confirmBox: {
    padding: 14, marginBottom: 16, borderWidth: 2, borderColor: "#b00020",
    borderRadius: 8, backgroundColor: "#fff5f5",
  },
  confirmTitle: { fontSize: 18, fontWeight: "700", marginBottom: 10 },
  warning: { color: "#b00020", marginVertical: 10 },
  buttons: { flexDirection: "row" },
  notice: { marginBottom: 12, fontSize: 16 },
  error: { color: "#b00020" },
  success: { color: "#176434" },
  errorBox: { marginBottom: 16 },
  spacing: { marginVertical: 12 },
  empty: { marginTop: 12 },
});