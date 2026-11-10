export type RoomConnectionState = "connecting" | "online" | "offline" | "denied";

export function roomConnectionLabel(state: RoomConnectionState, language = "en"): string {
  const labels = language === "zh"
    ? { connecting: "正在连接", online: "房间已连接", offline: "连接中断，正在重连", denied: "无法访问房间" }
    : { connecting: "Connecting...", online: "Room online", offline: "Disconnected · reconnecting", denied: "Room unavailable" };
  return labels[state];
}

export function roomConnectionMessage(state: RoomConnectionState, language = "en"): string {
  if (language === "zh") {
    switch (state) {
      case "connecting": return "正在连接房间，连接完成后即可编辑。";
      case "offline": return "连接已中断，正在重新连接；编辑暂时不可用。";
      case "denied": return "无法访问此房间，请联系房间所有者获取权限。";
      case "online": return "";
    }
  }
  switch (state) {
    case "connecting": return "Connecting to the room. Editing will be available after the connection is ready.";
    case "offline": return "Connection lost. Editing is paused while the room reconnects.";
    case "denied": return "Access to this room is unavailable. Ask the room owner for access.";
    case "online": return "";
  }
}
