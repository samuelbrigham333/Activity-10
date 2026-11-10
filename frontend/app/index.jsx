import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Image, ActivityIndicator, StyleSheet,Button } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { styles } from "../styles/styles.js";
import { BASE_URL } from "../config.js";

export default function Home() {
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);

const [error, setError] = useState(null);   // null or { message, code }

const fetchRobots = useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const res = await fetch(`${BASE_URL}/robots`);

    if (!res.ok) {
      // Try to read the backend's {"detail": "..."} message
      let detail = "";
      try {
        const body = await res.json();
        detail = body.detail;
      } catch {}

      let message;
      switch (res.status) {
        case 404:
          message = detail || "Robots not found.";
          break;
        case 503:
          message = "Service unavailable. Please try again later.";
          break;
        case 500:
          message = "Server error. Please contact support.";
          break;
        default:
          message = detail || "Unexpected error.";
      }

      const err = new Error(message);
      err.status = res.status;           // attach the code
      throw err;
    }

    const data = await res.json();
    setRobots(data);
  } catch (err) {
    console.log("Fetch robots error:", err);   // technical detail for the developer
    setRobots([]);   // hide the old list when the request fails

    if (err instanceof TypeError) {
      // fetch itself failed (server off, no internet)
      setError({ message: "Cannot reach the server. Check your connection.", code: null });
    } else {
      setError({ message: err.message, code: err.status ?? null });
    }
  } finally {
    setLoading(false);
  }
}, []);

useFocusEffect(
  useCallback(() => {
    fetchRobots();
  }, [fetchRobots])
);

return (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>Robots</Text>
      <Link href="/add" style={styles.addBtn}>+ Add</Link>
      {/* <Link href="/modify" style={styles.addBtn}>+ Modify</Link>
      <Link href="/delete" style={styles.addBtn}>+ Delete</Link>
      <Link href="/search" style={styles.addBtn}>+ Search</Link> */}
    </View>

    {loading && <ActivityIndicator size="large" />}

    {error && (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>{error.message}</Text>
        {error.code && (
          <Text style={{ fontSize: 12, color: "gray" }}>Error code: {error.code}</Text>
        )}
        <Button title="Retry" onPress={fetchRobots} />
      </View>
    )}

    <FlatList
      data={robots}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => (
        <View style={styles.card}>
          {!!item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.img} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text>${item.price}</Text>
            <Text>{item.description}</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={
        !loading && !error ? <Text>No robots yet.</Text> : null
      }
    />
  </View>
);
}

