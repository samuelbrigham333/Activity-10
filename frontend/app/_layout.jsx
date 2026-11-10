// app/_layout.jsx
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#111827" },
        headerTintColor: "#fff",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Robots" }} />
      <Stack.Screen name="add" options={{ title: "Add Robot" }} />
      <Stack.Screen name="modify" options={{ title: "Modify Robot" }} />
      <Stack.Screen name="delete" options={{ title: "Delete Robot" }} />
      <Stack.Screen name="search" options={{ title: "Search Robot" }} />
    </Stack>
  );
}

