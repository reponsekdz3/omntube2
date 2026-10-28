import { supabase } from "./supabase";

export interface IceServerConfig {
  urls: string | string[];
}

export const DEFAULT_RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

export interface WebRTCSignalingMessage {
  type: "offer" | "answer" | "ice" | "join" | "leave" | "status";
  senderId: string;
  targetId?: string; // If direct to specific peer
  streamId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  payload?: any;
}

/**
 * Audio VU meter helper that taps into a MediaStream audio track
 * and calculates current volume percentage (0 - 100)
 */
export class AudioMeter {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private rafId: number | null = null;
  private onLevelUpdate: (level: number) => void;

  constructor(onLevelUpdate: (level: number) => void) {
    this.onLevelUpdate = onLevelUpdate;
  }

  attach(stream: MediaStream) {
    this.detach();
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;

      const mediaStream = new MediaStream([audioTrack]);
      this.source = this.audioCtx.createMediaStreamSource(mediaStream);
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      const tick = () => {
        if (!this.analyser || !this.dataArray) return;
        this.analyser.getByteFrequencyData(this.dataArray as any);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          sum += this.dataArray[i];
        }
        const average = sum / this.dataArray.length;
        // Normalize 0-255 to 0-100
        const percentage = Math.min(100, Math.round((average / 128) * 100));
        this.onLevelUpdate(percentage);
        this.rafId = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn("Could not attach WebRTC audio meter:", e);
    }
  }

  detach() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch {}
      this.source = null;
    }
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      try { void this.audioCtx.close(); } catch {}
      this.audioCtx = null;
    }
    this.onLevelUpdate(0);
  }
}

/**
 * WebRTC Broadcaster Manager
 * Handles local camera/screen streams, peer connections to viewers,
 * and Supabase Realtime signaling.
 */
export class WebRTCBroadcaster {
  public streamId: string;
  public broadcasterId: string;
  public localStream: MediaStream | null = null;
  public screenStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private channel: ReturnType<typeof supabase.channel> | null = null;
  public isScreenSharing = false;
  public facingMode: "user" | "environment" = "user";
  public audioMeter: AudioMeter;
  public onViewerCountChange?: (count: number) => void;
  public onStatusChange?: (status: string) => void;
  public onAudioLevel?: (level: number) => void;

  constructor(streamId: string, broadcasterId: string) {
    this.streamId = streamId;
    this.broadcasterId = broadcasterId;
    this.audioMeter = new AudioMeter((level) => {
      this.onAudioLevel?.(level);
    });
  }

  async startCamera(facing: "user" | "environment" = "user"): Promise<MediaStream> {
    this.facingMode = facing;
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facing,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.localStream = stream;
    this.isScreenSharing = false;
    this.audioMeter.attach(stream);

    // If active peer connections exist, replace tracks
    this.updatePeerTracks(stream);

    return stream;
  }

  async toggleCamera(): Promise<"user" | "environment"> {
    const nextFacing = this.facingMode === "user" ? "environment" : "user";
    await this.startCamera(nextFacing);
    return nextFacing;
  }

  async startScreenShare(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Screen sharing is not supported on this browser or platform.");
    }

    const screen = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" } as any,
      audio: true,
    });

    this.screenStream = screen;
    this.isScreenSharing = true;

    // Handle screen share stop button pressed in OS/browser UI
    screen.getVideoTracks()[0].onended = async () => {
      await this.stopScreenShare();
    };

    // Keep audio from mic if screen doesn't provide audio
    let combinedStream: MediaStream;
    if (screen.getAudioTracks().length === 0 && this.localStream?.getAudioTracks().length) {
      combinedStream = new MediaStream([
        ...screen.getVideoTracks(),
        ...this.localStream.getAudioTracks(),
      ]);
    } else {
      combinedStream = screen;
    }

    this.updatePeerTracks(combinedStream);
    return combinedStream;
  }

  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    this.isScreenSharing = false;
    if (this.localStream) {
      this.updatePeerTracks(this.localStream);
    }
  }

  private updatePeerTracks(stream: MediaStream) {
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      if (videoTrack) {
        const videoSender = senders.find((s) => s.track?.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(videoTrack).catch(console.warn);
        } else {
          pc.addTrack(videoTrack, stream);
        }
      }
      if (audioTrack) {
        const audioSender = senders.find((s) => s.track?.kind === "audio");
        if (audioSender) {
          audioSender.replaceTrack(audioTrack).catch(console.warn);
        } else {
          pc.addTrack(audioTrack, stream);
        }
      }
    });
  }

  connectSignaling() {
    if (this.channel) return;
    const channelName = `webrtc-stream-${this.streamId}`;

    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    this.channel
      .on("broadcast", { event: "webrtc-msg" }, async ({ payload }) => {
        const msg = payload as WebRTCSignalingMessage;
        if (!msg || msg.streamId !== this.streamId) return;

        // When a viewer joins, broadcaster creates an offer for that viewer
        if (msg.type === "join") {
          await this.handleViewerJoin(msg.senderId);
        } else if (msg.type === "answer" && msg.targetId === this.broadcasterId && msg.sdp) {
          await this.handleViewerAnswer(msg.senderId, msg.sdp);
        } else if (msg.type === "ice" && msg.targetId === this.broadcasterId && msg.candidate) {
          await this.handleViewerIce(msg.senderId, msg.candidate);
        } else if (msg.type === "leave") {
          this.handleViewerLeave(msg.senderId);
        }
      })
      .subscribe((status) => {
        this.onStatusChange?.(status);
        if (status === "SUBSCRIBED") {
          // Announce that broadcaster is ready
          this.broadcastMsg({
            type: "status",
            senderId: this.broadcasterId,
            streamId: this.streamId,
            payload: { isLive: true },
          });
        }
      });
  }

  private async handleViewerJoin(viewerId: string) {
    const pc = new RTCPeerConnection(DEFAULT_RTC_CONFIGURATION);
    this.peerConnections.set(viewerId, pc);
    this.onViewerCountChange?.(this.peerConnections.size);

    const activeStream = this.isScreenSharing && this.screenStream ? this.screenStream : this.localStream;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => pc.addTrack(track, activeStream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.broadcastMsg({
          type: "ice",
          senderId: this.broadcasterId,
          targetId: viewerId,
          streamId: this.streamId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.handleViewerLeave(viewerId);
      }
    };

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      this.broadcastMsg({
        type: "offer",
        senderId: this.broadcasterId,
        targetId: viewerId,
        streamId: this.streamId,
        sdp: offer,
      });
    } catch (err) {
      console.warn("Failed to create WebRTC offer for viewer:", err);
    }
  }

  private async handleViewerAnswer(viewerId: string, sdp: RTCSessionDescriptionInit) {
    const pc = this.peerConnections.get(viewerId);
    if (!pc) return;
    try {
      if (pc.signalingState !== "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    } catch (e) {
      console.warn("Error setting remote description from viewer:", e);
    }
  }

  private async handleViewerIce(viewerId: string, candidate: RTCIceCandidateInit) {
    const pc = this.peerConnections.get(viewerId);
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("Error adding ICE candidate from viewer:", e);
    }
  }

  private handleViewerLeave(viewerId: string) {
    const pc = this.peerConnections.get(viewerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(viewerId);
      this.onViewerCountChange?.(this.peerConnections.size);
    }
  }

  private broadcastMsg(msg: WebRTCSignalingMessage) {
    if (!this.channel) return;
    this.channel.send({
      type: "broadcast",
      event: "webrtc-msg",
      payload: msg,
    }).catch(console.warn);
  }

  stop() {
    this.audioMeter.detach();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    if (this.channel) {
      this.broadcastMsg({
        type: "leave",
        senderId: this.broadcasterId,
        streamId: this.streamId,
      });
      supabase.removeChannel(this.channel).catch(console.warn);
      this.channel = null;
    }
  }
}

/**
 * WebRTC Viewer Client
 * Connects to stream signaling, receives broadcaster offer,
 * exchanges ICE, and mounts incoming remote tracks.
 */
export class WebRTCViewer {
  public streamId: string;
  public viewerId: string;
  private pc: RTCPeerConnection | null = null;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  public remoteStream: MediaStream = new MediaStream();
  public onTrackReceived?: (stream: MediaStream) => void;
  public onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  public onLiveStatusChange?: (isLive: boolean) => void;

  constructor(streamId: string, viewerId: string) {
    this.streamId = streamId;
    this.viewerId = viewerId;
  }

  connect() {
    if (this.channel) return;
    const channelName = `webrtc-stream-${this.streamId}`;

    this.pc = new RTCPeerConnection(DEFAULT_RTC_CONFIGURATION);

    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!this.remoteStream.getTracks().includes(track)) {
          this.remoteStream.addTrack(track);
        }
      });
      this.onTrackReceived?.(this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.onConnectionStateChange?.(this.pc.connectionState);
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.channel) {
        this.channel.send({
          type: "broadcast",
          event: "webrtc-msg",
          payload: {
            type: "ice",
            senderId: this.viewerId,
            streamId: this.streamId,
            candidate: event.candidate.toJSON(),
          } as WebRTCSignalingMessage,
        }).catch(console.warn);
      }
    };

    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    this.channel
      .on("broadcast", { event: "webrtc-msg" }, async ({ payload }) => {
        const msg = payload as WebRTCSignalingMessage;
        if (!msg || msg.streamId !== this.streamId) return;

        if (msg.type === "offer" && (msg.targetId === this.viewerId || !msg.targetId) && msg.sdp) {
          if (!this.pc) return;
          try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);

            this.channel?.send({
              type: "broadcast",
              event: "webrtc-msg",
              payload: {
                type: "answer",
                senderId: this.viewerId,
                targetId: msg.senderId,
                streamId: this.streamId,
                sdp: answer,
              } as WebRTCSignalingMessage,
            }).catch(console.warn);
          } catch (err) {
            console.warn("Failed handling WebRTC offer:", err);
          }
        } else if (msg.type === "ice" && (msg.targetId === this.viewerId || !msg.targetId) && msg.candidate) {
          if (this.pc && this.pc.remoteDescription) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (e) {
              console.warn("Error adding remote ICE candidate:", e);
            }
          }
        } else if (msg.type === "leave") {
          this.onLiveStatusChange?.(false);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Announce presence so broadcaster can send offer
          this.channel?.send({
            type: "broadcast",
            event: "webrtc-msg",
            payload: {
              type: "join",
              senderId: this.viewerId,
              streamId: this.streamId,
            } as WebRTCSignalingMessage,
          }).catch(console.warn);
        }
      });
  }

  disconnect() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.channel) {
      this.channel.send({
        type: "broadcast",
        event: "webrtc-msg",
        payload: {
          type: "leave",
          senderId: this.viewerId,
          streamId: this.streamId,
        } as WebRTCSignalingMessage,
      }).catch(console.warn);
      supabase.removeChannel(this.channel).catch(console.warn);
      this.channel = null;
    }
  }
}
