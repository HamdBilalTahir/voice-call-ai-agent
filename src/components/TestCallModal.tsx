"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
} from "@livekit/components-react";
import "@livekit/components-styles";

interface TestCallModalProps {
  agentKey: string;
  onClose: () => void;
}

export function TestCallModal({ agentKey, onClose }: TestCallModalProps) {
  const [token, setToken] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const connectToAgent = async () => {
    setIsConnecting(true);
    setError("");
    try {
      const roomName = `test-${agentKey}-${Date.now()}`;

      // 1. Get LiveKit Token
      const tokenRes = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          participantName: "Test User",
          participantIdentity: `test-user-${Math.random().toString(36).substring(7)}`,
        }),
      });

      if (!tokenRes.ok) throw new Error("Failed to get token");
      const tokenData = await tokenRes.json();

      // 2. Dispatch Agent to Room
      const dispatchRes = await fetch("/api/calls/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, agentKey }),
      });

      if (!dispatchRes.ok) throw new Error("Failed to dispatch agent");

      setToken(tokenData.token);
      setUrl(tokenData.url);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to connect to agent");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-white mb-6">Test Call</h2>

        {!token ? (
          <div className="flex flex-col items-center py-8">
            <p className="text-neutral-400 text-center mb-6">
              Connect via your browser microphone to test the {agentKey} agent
              directly without placing a phone call.
            </p>
            {error && (
              <div className="text-red-400 text-sm mb-4 bg-red-900/20 p-3 rounded-lg border border-red-900/50">
                {error}
              </div>
            )}
            <button
              onClick={connectToAgent}
              disabled={isConnecting}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              {isConnecting && (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              )}
              {isConnecting ? "Connecting..." : "Connect Microphone"}
            </button>
          </div>
        ) : (
          <LiveKitRoom
            video={false}
            audio={true}
            token={token}
            serverUrl={url}
            connect={true}
            onDisconnected={onClose}
            className="flex flex-col items-center justify-center py-8"
            data-lk-theme="default"
          >
            <div className="bg-neutral-800 rounded-xl p-6 w-full flex flex-col items-center gap-6 border border-neutral-700">
              <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 animate-pulse flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-white font-medium text-center">
                Connected to Agent
              </p>

              <div className="w-full">
                <VoiceAssistantControlBar controls={{ leave: true }} />
                <RoomAudioRenderer />
              </div>
            </div>
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}
