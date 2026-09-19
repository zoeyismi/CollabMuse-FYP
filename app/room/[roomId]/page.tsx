"use client";

import { useParams } from "next/navigation";
import { DemoRoomWorkspace } from "@/components/DemoRoomWorkspace";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = decodeURIComponent(params.roomId);

  return <DemoRoomWorkspace roomId={roomId} initialTitle={`${roomId} room`} />;
}
