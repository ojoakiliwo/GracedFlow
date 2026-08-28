import { Navigate, Route, Routes } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";
import PublicLayout from "./components/PublicLayout";

import Home from "./pages/public/Home";
import About from "./pages/public/About";
import Founder from "./pages/public/Founder";
import Programs from "./pages/public/Programs";
import ProgramDetail from "./pages/public/ProgramDetail";
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

function RoleGate({ min, children }: { min: "worker" | "pastor" | "admin"; children: ReactNode }) {
  const { hasRole } = useAuth();
  if (!hasRole(min)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/founder" element={<Founder />} />
        <Route path="/founding-president" element={<Founder />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/programs/:id" element={<ProgramDetail />} />
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
        <Route path="members" element={<RoleGate min="pastor"><Members /></RoleGate>} />
        <Route path="members/:id" element={<RoleGate min="pastor"><MemberDetail /></RoleGate>} />
        <Route path="departments" element={<Departments />} />
        <Route path="departments/:id" element={<DepartmentRoom />} />
        <Route path="projects" element={<RoleGate min="pastor"><Projects /></RoleGate>} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="events" element={<RoleGate min="pastor"><Events /></RoleGate>} />
        <Route path="messages" element={<RoleGate min="pastor"><Messages /></RoleGate>} />
        <Route path="automations" element={<RoleGate min="admin"><Automations /></RoleGate>} />
        <Route path="social" element={<RoleGate min="admin"><Social /></RoleGate>} />
        <Route path="giving" element={<RoleGate min="admin"><Giving /></RoleGate>} />
        <Route path="prayer" element={<RoleGate min="pastor"><PrayerRequests /></RoleGate>} />
        <Route path="settings" element={<RoleGate min="admin"><Settings /></RoleGate>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
