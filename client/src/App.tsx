import { Navigate, Route, Routes } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";
import PublicLayout from "./components/PublicLayout";

import Home from "./pages/public/Home";
import About from "./pages/public/About";
import Give from "./pages/public/Give";
import GiveCallback from "./pages/public/GiveCallback";
import Prayer from "./pages/public/Prayer";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

import Dashboard from "./pages/app/Dashboard";
import Members from "./pages/app/Members";
import MemberDetail from "./pages/app/MemberDetail";
import Departments from "./pages/app/Departments";
import DepartmentRoom from "./pages/app/DepartmentRoom";
import Projects from "./pages/app/Projects";
import Meetings from "./pages/app/Meetings";
import Tasks from "./pages/app/Tasks";
import Events from "./pages/app/Events";
import Messages from "./pages/app/Messages";
import Automations from "./pages/app/Automations";
import Social from "./pages/app/Social";
import Studio from "./pages/app/Studio";
import Giving from "./pages/app/Giving";
import PrayerRequests from "./pages/app/PrayerRequests";
import Settings from "./pages/app/Settings";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/give" element={<Give />} />
        <Route path="/give/callback" element={<GiveCallback />} />
        <Route path="/prayer" element={<Prayer />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/app"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="members" element={<Members />} />
        <Route path="members/:id" element={<MemberDetail />} />
        <Route path="departments" element={<Departments />} />
        <Route path="departments/:id" element={<DepartmentRoom />} />
        <Route path="projects" element={<Projects />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="events" element={<Events />} />
        <Route path="messages" element={<Messages />} />
        <Route path="automations" element={<Automations />} />
        <Route path="social" element={<Social />} />
        <Route path="studio" element={<Studio />} />
        <Route path="giving" element={<Giving />} />
        <Route path="prayer" element={<PrayerRequests />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
