import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import * as Haptics from "expo-haptics";
import { AppScreen, Avatar, Brand, EmptyState } from "../../src/components/ui";
import { useAuth } from "../../src/lib/AuthContext";
import { formatCount, hydrateVideos, resolvePlayback, timeAgo } from "../../src/lib/media";
import { supabase } from "../../src/lib/supabase";
import type { VideoRow } from "../../src/lib/types";
import { theme } from "../../src/theme";
import { readDevicePreferences, type DevicePreferences } from "../../src/lib/preferences";

function ShortSlide({
  video,
  active,
  userId,
  onLike,
  onSave,
  onOpenSound,
  autoPlay,
  hapticsEnabled,
  reduceDataUsage,
}: {
  video: VideoRow;
  active: boolean;
  userId: string | null;
  onLike: () => void;
  onSave: () => void;
  onOpenSound: () => void;
  autoPlay: boolean;
  hapticsEnabled: boolean;
  reduceDataUsage: boolean;
}) {
  const [playback, setPlayback] = useState("");
  const [playbackError, setPlaybackError] = useState("");
  const [liked, setLiked] = useState(false);
  const [paused, setPaused] = useState(false);
  const player = useVideoPlayer(null, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });

  useEffect(() => {
    let activeRequest = true;
    if (!active) {
      player.pause();
      return () => {
        activeRequest = false;
      };
    }
    setPlaybackError("");
    void resolvePlayback(video.id)
      .then((url) => {
        if (!activeRequest) return;
        setPlayback(url);
        setPaused(!autoPlay);
        return player.replaceAsync({ uri: url, useCaching: !reduceDataUsage }).then(() => {
          if (!activeRequest) return;
          if (autoPlay) player.play();
          else player.pause();
        });
      })
      .catch((error) => {
        if (activeRequest)
          setPlaybackError(error instanceof Error ? error.message : "Playback could not be loaded.");
      });
    return () => {
      activeRequest = false;
      player.pause();
    };
  }, [active, video.id, player, autoPlay, reduceDataUsage]);

  useEffect(() => {
    let alive = true;
    if (!active || !userId) {
      setLiked(false);
      return () => {
        alive = false;
      };
    }
    void supabase
      .from("video_reactions")
      .select("reaction")
      .eq("video_id", video.id)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setLiked(data?.reaction === "like" || data?.reaction === "heart");
      });
    return () => {
      alive = false;
    };
  }, [active, userId, video.id]);

  return (
    <View style={styles.slide}>
      {active && playback ? (
        <>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (player.playing) {
                player.pause();
                setPaused(true);
              } else {
                player.play();
                setPaused(false);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={paused ? "Resume Short" : "Pause Short"}
          />
          {paused && (
            <View pointerEvents="none" style={styles.pausedBadge}>
              <Ionicons name="play" size={23} color="#FFFFFF" />
            </View>
          )}
        </>
      ) : (
        <View style={styles.videoFallback}>
          <View style={styles.fallbackOrb} />
          <Ionicons name="play" size={32} color={theme.violet} />
        </View>
      )}

      {/* Top Header */}
      <View style={styles.gradientTop}>
        <Brand compact />
        <View style={styles.shortsWord}>
          <Ionicons name="flash" size={14} color={theme.mint} />
          <Text style={styles.shortsWordText}>OMNI SHORTS</Text>
        </View>
      </View>

      {playbackError ? (
        <View style={styles.playbackError}>
          <Ionicons name="alert-circle-outline" size={23} color={theme.coral} />
          <Text style={styles.playbackErrorText}>{playbackError}</Text>
        </View>
      ) : !playback && active ? (
        <View style={styles.preparing}>
          <ActivityIndicator color={theme.mint} />
          <Text style={styles.preparingText}>Preparing secure playback…</Text>
        </View>
      ) : null}

      {/* Bottom Metadata & Controls */}
      <View style={styles.bottomGradient}>
        <View style={styles.bottomCopy}>
          <Pressable
            onPress={() => router.push({ pathname: "/creator/[id]", params: { id: video.creator_id } })}
            style={styles.creatorRow}
          >
            <Avatar profile={video.creator} size={36} />
            <Text style={styles.creatorName}>{video.creator?.display_name || "Creator"}</Text>
            {video.creator?.is_verified && (
              <Ionicons name="checkmark-circle" size={14} color={theme.mint} />
            )}
          </Pressable>

          <Text style={styles.videoTitle} numberOfLines={3}>
            {video.title}
          </Text>
          {video.description ? (
            <Text style={styles.videoDescription} numberOfLines={2}>
              {video.description}
            </Text>
          ) : null}

          {/* Sound Marquee Banner */}
          <Pressable onPress={onOpenSound} style={styles.soundBanner}>
            <Ionicons name="musical-notes" size={13} color={theme.mint} />
            <Text style={styles.soundBannerText} numberOfLines={1}>
              {video.title} · Original Sound
            </Text>
            <Ionicons name="chevron-forward" size={12} color="#A2A8BC" />
          </Pressable>

          <View style={styles.videoStats}>
            <Ionicons name="eye-outline" size={13} color="#C5C9D8" />
            <Text style={styles.videoStatsText}>
              {formatCount(video.views_count)} views · {timeAgo(video.published_at || video.created_at)}
            </Text>
          </View>
        </View>

        {/* Action Rail */}
        <View style={styles.actionRail}>
          <Pressable
            style={styles.railAction}
            onPress={async () => {
              if (hapticsEnabled) await Haptics.selectionAsync();
              setLiked((old) => !old);
              onLike();
            }}
          >
            <View style={[styles.railIcon, liked && styles.likedIcon]}>
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={23}
                color={liked ? theme.coral : theme.text}
              />
            </View>
            <Text style={styles.railLabel}>Like</Text>
          </Pressable>

          <Pressable
            style={styles.railAction}
            onPress={() => router.push({ pathname: "/watch/[id]", params: { id: video.id } })}
          >
            <View style={styles.railIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.text} />
            </View>
            <Text style={styles.railLabel}>Discuss</Text>
          </Pressable>

          <Pressable style={styles.railAction} onPress={onSave}>
            <View style={styles.railIcon}>
              <Ionicons name="bookmark-outline" size={22} color={theme.text} />
            </View>
            <Text style={styles.railLabel}>Save</Text>
          </Pressable>

          <Pressable
            style={styles.railAction}
            onPress={() =>
              void Share.share({
                message: video.title + "\n" + "omnitube:///watch/" + video.id,
              })
            }
          >
            <View style={styles.railIcon}>
              <Ionicons name="arrow-redo-outline" size={22} color={theme.text} />
            </View>
            <Text style={styles.railLabel}>Share</Text>
          </Pressable>

          {/* Vinyl Disc Button for Sound & Duet Drawer */}
          <Pressable style={styles.railAction} onPress={onOpenSound}>
            <View style={[styles.railIcon, styles.soundDiscIcon]}>
              <Ionicons name="disc" size={24} color={theme.mint} />
            </View>
            <Text style={styles.railLabel}>Sound</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function ShortsScreen() {
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const [soundModalVisible, setSoundModalVisible] = useState(false);
  const [selectedSoundVideo, setSelectedSoundVideo] = useState<VideoRow | null>(null);
  const [devicePreferences, setDevicePreferences] = useState<DevicePreferences>(() =>
    readDevicePreferences()
  );

  const listRef = useRef<FlatList<VideoRow>>(null);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const pageHeight = Math.max(420, height - 145);

  useFocusEffect(
    useCallback(() => {
      setDevicePreferences(readDevicePreferences());
    }, [])
  );

  const load = useCallback(async (reset = true) => {
    if (!reset && (!hasMoreRef.current || loadingMoreRef.current)) return;
    if (reset) {
      setLoading(true);
      pageRef.current = 0;
      hasMoreRef.current = true;
    } else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }
    const page = reset ? 0 : pageRef.current;
    const { data, error } = await supabase
      .from("videos")
      .select(
        "id,creator_id,title,description,video_path,thumbnail_path,duration_seconds,visibility,kind,status,category,tags,allow_comments,views_count,published_at,created_at,updated_at"
      )
      .eq("status", "published")
      .eq("visibility", "public")
      .eq("kind", "short")
      .order("published_at", { ascending: false })
      .range(page * 18, page * 18 + 17);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }
    try {
      const hydrated = await hydrateVideos((data || []) as unknown as VideoRow[]);
      setVideos((old) => (reset ? hydrated : [...old, ...hydrated]));
      pageRef.current = page + 1;
      hasMoreRef.current = (data || []).length === 18;
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not prepare Shorts.");
    }
    setLoading(false);
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const toggleLike = async (video: VideoRow) => {
    if (!user) {
      Alert.alert("Sign in to like", "Your reactions stay synced across devices.", [
        { text: "Cancel" },
        { text: "Sign in", onPress: () => router.push("/(tabs)/profile") },
      ]);
      return;
    }
    const { data } = await supabase
      .from("video_reactions")
      .select("reaction")
      .eq("video_id", video.id)
      .eq("user_id", user.id)
      .maybeSingle();
    const result = data
      ? await supabase.from("video_reactions").delete().eq("video_id", video.id).eq("user_id", user.id)
      : await supabase.from("video_reactions").insert({
          video_id: video.id,
          user_id: user.id,
          reaction: "like",
        });
    if (result.error) Alert.alert("Could not react", result.error.message);
  };

  const save = async (video: VideoRow) => {
    if (!user) {
      Alert.alert("Sign in to save videos", "Keep Shorts in Watch later.", [
        { text: "Cancel" },
        { text: "Sign in", onPress: () => router.push("/(tabs)/profile") },
      ]);
      return;
    }
    let { data: playlist } = await supabase
      .from("playlists")
      .select("id")
      .eq("owner_id", user.id)
      .eq("title", "Watch later")
      .maybeSingle();
    if (!playlist) {
      const result = await supabase
        .from("playlists")
        .insert({
          owner_id: user.id,
          title: "Watch later",
          description: "Saved from OmniTube.",
          visibility: "private",
        })
        .select("id")
        .single();
      if (result.error) {
        Alert.alert("Could not create library", result.error.message);
        return;
      }
      playlist = result.data;
    }
    const { error } = await supabase
      .from("playlist_items")
      .upsert(
        { playlist_id: playlist.id, video_id: video.id, position: 0 },
        { onConflict: "playlist_id,video_id" }
      );
    Alert.alert(
      error ? "Could not save" : "Saved to Watch later",
      error?.message || "Your Short is in your library."
    );
  };

  const handleOpenSoundDrawer = (v: VideoRow) => {
    setSelectedSoundVideo(v);
    setSoundModalVisible(true);
  };

  if (loading)
    return (
      <AppScreen>
        <View style={styles.loadingFull}>
          <Brand />
          <ActivityIndicator size="large" color={theme.mint} />
          <Text style={styles.preparingText}>Loading your Shorts feed…</Text>
        </View>
      </AppScreen>
    );

  if (!videos.length)
    return (
      <AppScreen>
        <View style={styles.emptyHeader}>
          <Brand />
        </View>
        <EmptyState
          icon="play-circle-outline"
          title="Your vertical universe is ready."
          detail={
            message ||
            "Published public Shorts will appear here. Upload a vertical video to start the next story."
          }
          action={
            <Pressable style={styles.emptyButton} onPress={() => router.push("/(tabs)/create")}>
              <Text style={styles.emptyButtonText}>Create a Short</Text>
            </Pressable>
          }
        />
      </AppScreen>
    );

  const activeSound = selectedSoundVideo || videos[active];

  return (
    <AppScreen style={{ paddingTop: 0 }}>
      <FlatList
        ref={listRef}
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ShortSlide
            video={item}
            active={index === active}
            userId={user?.id || null}
            onLike={() => void toggleLike(item)}
            onSave={() => void save(item)}
            onOpenSound={() => handleOpenSoundDrawer(item)}
            autoPlay={devicePreferences.autoPlayShorts}
            hapticsEnabled={devicePreferences.hapticsEnabled}
            reduceDataUsage={devicePreferences.reduceDataUsage}
          />
        )}
        pagingEnabled
        snapToInterval={pageHeight}
        decelerationRate="fast"
        snapToAlignment="start"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.y / pageHeight);
          setActive(next);
        }}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        onEndReachedThreshold={0.65}
        onEndReached={() => {
          if (!loading && !loadingMore) void load(false);
        }}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={theme.mint} style={{ marginVertical: 12 }} /> : undefined
        }
        style={{ flex: 1 }}
      />

      {/* Modern Sound & Duet Modal Drawer */}
      <Modal
        visible={soundModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSoundModalVisible(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={styles.modalDisc}>
                  <Ionicons name="disc" size={24} color={theme.mint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalSoundTitle} numberOfLines={1}>
                    {activeSound?.title}
                  </Text>
                  <Text style={styles.modalSoundCreator}>
                    Sound by {activeSound?.creator?.display_name || "OmnPlay Creator"}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setSoundModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            {/* Actions Grid */}
            <View style={styles.modalActionsGrid}>
              {/* Action 1: Use Sound */}
              <Pressable
                style={styles.modalActionCard}
                onPress={() => {
                  setSoundModalVisible(false);
                  router.push({
                    pathname: "/(tabs)/create",
                    params: {
                      soundId: activeSound?.id,
                      soundTitle: activeSound?.title,
                    },
                  });
                }}
              >
                <View style={[styles.modalActionIcon, { backgroundColor: "rgba(89, 235, 200, 0.15)" }]}>
                  <Ionicons name="camera" size={20} color={theme.mint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalActionTitle}>Use this Sound</Text>
                  <Text style={styles.modalActionSub}>Record camera take synced with audio</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.subtle} />
              </Pressable>

              {/* Action 2: Duet */}
              <Pressable
                style={styles.modalActionCard}
                onPress={() => {
                  setSoundModalVisible(false);
                  router.push({
                    pathname: "/(tabs)/create",
                    params: {
                      duetVideoId: activeSound?.id,
                      duetTitle: activeSound?.title,
                      duetMode: "split",
                    },
                  });
                }}
              >
                <View style={[styles.modalActionIcon, { backgroundColor: "rgba(255, 140, 156, 0.15)" }]}>
                  <Ionicons name="duplicate" size={20} color={theme.coral} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalActionTitle}>Duet / Video-in-Video</Text>
                  <Text style={styles.modalActionSub}>Side-by-side or PiP response take</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.subtle} />
              </Pressable>

              {/* Action 3: Blockchain Royalty & NFT License */}
              <Pressable
                style={styles.modalActionCard}
                onPress={() => {
                  Alert.alert(
                    "Blockchain Audio Royalty",
                    `Track: ${activeSound?.title}\nFingerprint: 0x${activeSound?.id?.slice(0, 16)}...\nRoyalty standard: ERC-2981 (5%)\nChain: BNB Smart Chain\n\nRoyalty tipping and audio NFT licensing are recorded immutably on EVM blockchains.`
                  );
                }}
              >
                <View style={[styles.modalActionIcon, { backgroundColor: "rgba(243, 186, 47, 0.15)" }]}>
                  <Ionicons name="shield-checkmark" size={20} color="#F3BA2F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalActionTitle}>Blockchain Royalty & NFT</Text>
                  <Text style={styles.modalActionSub}>ERC-2981 audio licensing & on-chain proof</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.subtle} />
              </Pressable>
            </View>

            {/* Swap Sound from Other Shorts */}
            {videos.length > 1 && (
              <View style={styles.swapSection}>
                <Text style={styles.swapTitle}>Swap with other sounds:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.swapScroll}>
                  {videos.slice(0, 8).map((vid) => (
                    <Pressable
                      key={vid.id}
                      onPress={() => setSelectedSoundVideo(vid)}
                      style={[
                        styles.swapPill,
                        activeSound?.id === vid.id && styles.swapPillActive,
                      ]}
                    >
                      <Ionicons
                        name="musical-note"
                        size={12}
                        color={activeSound?.id === vid.id ? theme.mint : theme.subtle}
                      />
                      <Text
                        style={[
                          styles.swapPillText,
                          activeSound?.id === vid.id && styles.swapPillTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {vid.title}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  slide: { height: "100%", backgroundColor: "#05060A", overflow: "hidden" },
  pausedBadge: {
    position: "absolute",
    top: "46%",
    left: "50%",
    width: 61,
    height: 61,
    marginLeft: -30.5,
    marginTop: -30.5,
    borderRadius: 31,
    backgroundColor: "#070910B8",
    borderWidth: 1,
    borderColor: "#FFFFFF45",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 3,
  },
  videoFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#111626",
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackOrb: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 150,
    backgroundColor: "#A99AFF16",
  },
  gradientTop: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  shortsWord: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#090B13C9",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  shortsWordText: { color: theme.text, fontSize: 9, letterSpacing: 1.2, fontWeight: "900" },
  bottomGradient: {
    position: "absolute",
    bottom: 21,
    left: 15,
    right: 13,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9,
    zIndex: 5,
  },
  bottomCopy: { flex: 1, paddingBottom: 6 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  creatorName: { color: theme.text, fontSize: 12, fontWeight: "900" },
  videoTitle: { color: "white", fontSize: 16, lineHeight: 21, fontWeight: "900" },
  videoDescription: { color: "#E2E5F0", fontSize: 11, lineHeight: 17, marginTop: 7 },
  soundBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(13, 16, 24, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(89, 235, 200, 0.3)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  soundBannerText: { color: theme.mint, fontSize: 10, fontWeight: "800", maxWidth: 200 },
  videoStats: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  videoStatsText: { color: "#D2D7E6", fontSize: 9, fontWeight: "600" },
  actionRail: { width: 46, alignItems: "center", gap: 14, paddingBottom: 8 },
  railAction: { alignItems: "center", gap: 4 },
  railIcon: {
    width: 43,
    height: 43,
    borderRadius: 16,
    backgroundColor: "#0B0D16B3",
    borderWidth: 1,
    borderColor: "#FFFFFF20",
    justifyContent: "center",
    alignItems: "center",
  },
  soundDiscIcon: {
    borderWidth: 1.5,
    borderColor: theme.mint,
    backgroundColor: "#081514B3",
  },
  likedIcon: { backgroundColor: "#FF8A9D25", borderColor: "#FF8A9D55" },
  railLabel: { color: "#F0F2FA", fontSize: 8, fontWeight: "800" },
  preparing: { position: "absolute", top: "45%", left: 0, right: 0, alignItems: "center", gap: 9 },
  preparingText: { color: "#D8DCEC", fontSize: 11 },
  playbackError: { position: "absolute", top: "45%", left: 25, right: 25, alignItems: "center", gap: 9 },
  playbackErrorText: { color: "#FFC2CB", textAlign: "center", fontSize: 11 },
  loadingFull: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  emptyHeader: { padding: 17 },
  emptyButton: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: theme.mint,
    borderRadius: 10,
    marginTop: 9,
  },
  emptyButtonText: { color: "#071712", fontWeight: "900", fontSize: 11 },

  // Sound Drawer Modal Styles
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0F121C",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: "rgba(89, 235, 200, 0.3)",
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  modalDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(89, 235, 200, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSoundTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "900",
  },
  modalSoundCreator: {
    color: theme.subtle,
    fontSize: 11,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  modalActionsGrid: {
    gap: 10,
  },
  modalActionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#161B29",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  modalActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalActionTitle: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "800",
  },
  modalActionSub: {
    color: theme.subtle,
    fontSize: 11,
    marginTop: 1,
  },
  swapSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  swapTitle: {
    color: theme.subtle,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },
  swapScroll: {
    flexDirection: "row",
  },
  swapPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "#161B29",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginRight: 8,
    maxWidth: 160,
  },
  swapPillActive: {
    borderColor: theme.mint,
    backgroundColor: "rgba(89, 235, 200, 0.15)",
  },
  swapPillText: {
    color: theme.subtle,
    fontSize: 11,
    fontWeight: "600",
  },
  swapPillTextActive: {
    color: theme.mint,
    fontWeight: "800",
  },
});
