import { useState } from "react";
import { FlatList, Text, TextInput, View, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { EmptyState } from "@/components/EmptyState";
import { useKbArticles } from "@/api/queries";
import { api } from "@/api/client";
import { colors } from "@/theme/colors";

export default function KbScreen() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<any>(null);
  const { data, isLoading } = useKbArticles(q);
  const articles = data || [];

  const open = async (slug: string) => {
    const full = await api(`/api/kb/${slug}`);
    setActive(full);
  };

  return (
    <Screen edges={[]}>
      <View style={{ padding: 12, backgroundColor: colors.bgDeep }}>
        <View
          style={{
            backgroundColor: colors.bgInput,
            borderRadius: 10,
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            placeholder="Search knowledge base"
            placeholderTextColor={colors.muted}
            value={q}
            onChangeText={setQ}
            style={{ flex: 1, color: colors.textBright, paddingVertical: 10 }}
            autoCorrect={false}
          />
        </View>
      </View>
      {isLoading ? null : articles.length === 0 ? (
        <EmptyState title="No articles" hint="Try a different search." />
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(a) => String(a.id)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item.slug)}
              style={({ pressed }) => ({
                padding: 14,
                backgroundColor: pressed ? colors.bgPanel : "transparent",
                borderBottomWidth: 1,
                borderBottomColor: colors.bgDeep,
              })}
            >
              <Text style={{ color: colors.textBright, fontWeight: "600", marginBottom: 2 }}>
                {item.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
                {item.excerpt}
              </Text>
              {item.category && (
                <Text style={{ color: colors.accent, fontSize: 11, marginTop: 4 }}>
                  {item.category}
                </Text>
              )}
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={!!active}
        animationType="slide"
        onRequestClose={() => setActive(null)}
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View
            style={{
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              borderBottomWidth: 1,
              borderBottomColor: colors.bgDeep,
            }}
          >
            <Text
              style={{
                flex: 1,
                color: colors.textBright,
                fontWeight: "700",
                fontSize: 17,
              }}
            >
              {active?.title}
            </Text>
            <Pressable onPress={() => setActive(null)}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={{ color: colors.text, lineHeight: 22 }}>{active?.body_md}</Text>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}
