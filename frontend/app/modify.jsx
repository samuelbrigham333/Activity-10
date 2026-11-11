import { useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { BASE_URL } from "../config.js";

const EMPTY = { name: "", price: "", description: "", imageUrl: "" };

// Handles both FastAPI string errors and its list of validation errors.
function errorDetail(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = (item.loc || [])
          .filter((part) => part !== "body")
          .join(".");
        return `${field || "Request"}: ${item.msg || "Invalid value"}`;
      })
      .join("\n");
  }
  return "Request failed.";
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${BASE_URL.replace(/\/+$/, "")}${path}`, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const fallback =
        {
          404: "Robot or collection not found.",
          409: "Another robot already has that name.",
          422: "Check the values entered.",
          500: "Internal server error.",
          503: "Database service unavailable. Try again later.",
        }[response.status] || "Request failed.";
      throw new Error(
        `HTTP ${response.status}: ${data?.detail ? errorDetail(data.detail) : fallback}`,
      );
    }
    if (data === null)
      throw new Error("Server returned an empty or invalid JSON response.");
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "Request timed out. If saving, reload the robot before retrying; the update may have completed.",
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Cannot reach the server. Check your connection and BASE_URL. If saving, reload before retrying.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Enter a robot name.";
  const priceText = form.price.trim();
  if (!/^\d+(\.\d+)?$/.test(priceText) || !Number.isFinite(Number(priceText))) {
    errors.price = "Enter a finite, nonnegative price, such as 24.50.";
  }
  if (!form.description.trim()) errors.description = "Enter a description.";
  try {
    const url = new URL(form.imageUrl.trim());
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname)
      throw new Error();
  } catch {
    errors.imageUrl = "Enter a valid HTTP or HTTPS image URL.";
  }
  return errors;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !!url.hostname;
  } catch {
    return false;
  }
}

// Small preview. Waits briefly after typing stops so it doesn't fetch on every keystroke.
function Thumbnail({ url }) {
  const [shownUrl, setShownUrl] = useState(url.trim());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShownUrl(url.trim());
      setFailed(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [url]);

  const valid = isHttpUrl(shownUrl);

  return (
    <View style={s.thumbBox}>
      {valid && !failed ? (
        <Image
          source={{ uri: shownUrl }}
          style={s.thumb}
          resizeMode="contain"
          onError={() => setFailed(true)}
          accessibilityLabel="Robot image preview"
        />
      ) : (
        <Text style={s.thumbText}>{valid ? "Can't load" : "No image"}</Text>
      )}
    </View>
  );
}

export default function Modify() {
  const [searchName, setSearchName] = useState("");
  const [originalName, setOriginalName] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);
  const lock = useRef(false);

  function edit(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setMessage(null);
  }

  async function findRobot() {
    if (lock.current) return;
    setOriginalName(null);
    setErrors({});
    setMessage(null);
    const name = searchName.trim();
    if (!name) {
      setMessage({ error: true, text: "Enter the name to search for." });
      return;
    }
    lock.current = true;
    setBusy("search");
    try {
      // Existing backend: GET /robotse returns an array of robots.
      const robots = await request("/robots");
      if (!Array.isArray(robots))
        throw new Error("Server did not return a robot list.");
      const matches = robots.filter((robot) => robot?.name === name);
      if (matches.length === 0)
        throw new Error(`Robot '${name}' not found. Names are case-sensitive.`);
      if (matches.length > 1)
        throw new Error(
          "Multiple robots have this name. Resolve duplicate names before updating.",
        );
      const robot = matches[0];
      if (
        typeof robot.name !== "string" ||
        typeof robot.price !== "number" ||
        !Number.isFinite(robot.price) ||
        typeof robot.description !== "string" ||
        typeof robot.imageUrl !== "string"
      ) {
        throw new Error("The stored robot has missing or invalid fields.");
      }
      setForm({
        name: robot.name,
        price: String(robot.price),
        description: robot.description,
        imageUrl: robot.imageUrl,
      });
      setOriginalName(robot.name);
      setMessage({
        error: false,
        text: "Robot found. Edit the fields, then press Confirm Modify.",
      });
    } catch (error) {
      setMessage({ error: true, text: error.message });
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function saveRobot() {
    if (lock.current || originalName === null) return;
    setMessage(null);
    const foundErrors = validate(form);
    setErrors(foundErrors);
    if (Object.keys(foundErrors).length) {
      setMessage({ error: true, text: "Correct the highlighted fields." });
      return;
    }
    const body = {
      name: form.name.trim(),
      price: Number(form.price.trim()),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
    };
    lock.current = true;
    setBusy("save");
    try {
      // Use the ORIGINAL name even when the user edits the Name field.
      const result = await request(
        `/robotse/${encodeURIComponent(originalName)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setOriginalName(body.name);
      setSearchName(body.name);
      setForm({ ...body, price: String(body.price) });
      setMessage({
        error: false,
        text: result.message || "Robot updated successfully.",
      });
    } catch (error) {
      // Keep entered values so the user can correct them or retry.
      setMessage({ error: true, text: error.message });
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.title}>Modify Robot</Text>
      <Text style={s.label}>Robot name to find</Text>
      <TextInput
        style={s.input}
        value={searchName}
        editable={!busy}
        placeholder="Robot 1"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={(value) => {
          setSearchName(value);
          setOriginalName(null);
          setMessage(null);
          setErrors({});
        }}
      />
      <Button
        title={busy === "search" ? "Searching..." : "Find Robot"}
        onPress={findRobot}
        disabled={!!busy}
      />

      {originalName !== null && (
        <View style={s.form}>
          <Text style={s.hint}>Editing: {originalName}</Text>
          {[
            ["name", "Name", "Robot name"],
            ["price", "Price", "24.50"],
            ["description", "Description", "Robot description"],
            ["imageUrl", "Image URL", "https://robohash.org/robot1"],
          ].map(([field, label, placeholder]) => (
            <View key={field}>
              <Text style={s.label}>{label}</Text>
              <View style={field === "imageUrl" ? s.row : null}>
                <TextInput
                  style={[
                    s.input,
                    field === "description" && s.multiline,
                    field === "imageUrl" && s.flex,
                    errors[field] && s.invalid,
                  ]}
                  value={form[field]}
                  onChangeText={(value) => edit(field, value)}
                  editable={!busy}
                  placeholder={placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={
                    field === "price"
                      ? "decimal-pad"
                      : field === "imageUrl"
                        ? "url"
                        : "default"
                  }
                  multiline={field === "description"}
                />
                {field === "imageUrl" && <Thumbnail url={form.imageUrl} />}
              </View>
              {!!errors[field] && <Text style={s.error}>{errors[field]}</Text>}
            </View>
          ))}
          <Button
            title={busy === "save" ? "Saving..." : "Confirm Modify"}
            onPress={saveRobot}
            disabled={!!busy}
          />
        </View>
      )}
      {!!busy && <ActivityIndicator style={s.spacing} size="large" />}
      {!!message && (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.notice, message.error ? s.error : s.success]}
        >
          {message.text}
        </Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 48,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 20 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#888",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: "#111",
    backgroundColor: "#fff",
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  invalid: { borderColor: "#b00020" },
  form: { marginTop: 24 },
  hint: { color: "#555", marginBottom: 16 },
  error: { color: "#b00020", marginBottom: 12 },
  success: { color: "#176434" },
  notice: { marginTop: 18, fontSize: 16 },
  spacing: { marginTop: 16 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  flex: { flex: 1 },
  thumbBox: {
    width: 48,
    height: 48,
    marginLeft: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#888",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#f4f4f4",
  },
  thumb: { width: "100%", height: "100%" },
  thumbText: { fontSize: 9, color: "#666", textAlign: "center" },
});
