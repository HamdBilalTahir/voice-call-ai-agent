"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
} from "@livekit/components-react";
import "@livekit/components-styles";

export default function Home() {
  const [token, setToken] = useState<string>("");
  const [url, setUrl] = useState<string>("");

  const connectToAgent = async () => {
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomName: "dev-room-1",
          participantName: "Developer",
          participantIdentity: `dev-${Math.random().toString(36).substring(7)}`,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch token");
      }

      const data = await res.json();
      setToken(data.token);
      setUrl(data.url);
    } catch (e) {
      console.error(e);
      alert("Error generating token. Check console.");
    }
  };

  if (token === "") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-neutral-900 text-white">
        <h1 className="text-4xl font-bold mb-8">AI Agent Voice Call Dev</h1>
        <button
          onClick={connectToAgent}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
        >
          Connect to Agent
        </button>
      </main>
    );
  }

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={url}
      connect={true}
      onDisconnected={() => setToken("")}
      className="h-screen bg-neutral-900 flex flex-col items-center justify-center"
      data-lk-theme="default"
    >
      <div className="flex flex-col items-center p-8 bg-neutral-800 rounded-2xl shadow-xl max-w-sm w-full">
        <h2 className="text-2xl font-bold text-white mb-6">Agent Connected</h2>

        {/* Render the voice assistant control bar and audio */}
        <VoiceAssistantControlBar controls={{ leave: true }} />
        <RoomAudioRenderer />
      </div>
    </LiveKitRoom>
  );
}
