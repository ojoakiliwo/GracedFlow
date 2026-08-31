import { Outlet } from "react-router-dom";
import { BroadcastStudioProvider } from "../../lib/useBroadcastStudio";

export default function StudioLayout() {
  return (
    <BroadcastStudioProvider>
      <Outlet />
    </BroadcastStudioProvider>
  );
}
