import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { styles } from "../styles/styles.js";
import { BASE_URL } from "../config";

export default function Add() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

// const saveRobot = async () => {
//   const body = { name, price: parseFloat(price), description, imageUrl };

//   const res = await fetch(`${BASE_URL}/robots`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(body),
//   });

//   const data = await res.json();
//   Alert.alert("Response", data.message || data.detail);
// };

const saveRobot = async () => {
  const body = { name, price: parseFloat(price), description, imageUrl };
  try {
    const res = await fetch(`${BASE_URL}/robots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
      
    const json = await res.json();  // success OR error JSON

    if (!res.ok) {
      const detail = json?.detail ?? "Request failed";
      Alert.alert("Error", `HTTP ${res.status} – ${detail}`);
      return;
    }
    // success
    Alert.alert("Success", json.message ?? "Created");

  } catch (e) {
    Alert.alert("Network Error", String(e.message));
  }
};





  return (
    <View style={styles.container}>
      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Robot name" />

      <Text style={styles.label}>Price</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="19.99" keyboardType="numeric" />

      <Text style={styles.label}>Description</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Short description" />

      <Text style={styles.label}>Image URL</Text>
      <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="https://robohash.org/robot" />

      <TouchableOpacity style={styles.btn} onPress={saveRobot}>
        <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>Save Robot</Text>
      </TouchableOpacity>
    </View>
  );
}
