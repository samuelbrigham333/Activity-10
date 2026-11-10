import { StyleSheet } from "react-native";
export const styles = StyleSheet.create({
container: { flex: 1, padding: 16, backgroundColor: "#fafafa" },
header: {
flexDirection: "row",
justifyContent: "space-between",
marginBottom: 10,
},
title: { fontSize: 24, fontWeight: "700" },
addBtn: {
backgroundColor: "#111827",
color: "white",
padding: 8,
borderRadius: 8,
},
card: {
flexDirection: "row",
gap: 10,
backgroundColor: "white",
padding: 10,
borderRadius: 10,
marginBottom: 10,
},
img: { width: 64, height: 64, borderRadius: 8 },
name: { fontWeight: "700" },
});