import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import { AppShell } from "./components/layout/AppShell";
import { Login } from "./pages/Login";
import { AuthSuccess } from "./pages/AuthSuccess";
import { Landing } from "./pages/Landing";
import { Repositories } from "./pages/Repositories";
import { RepositoryImport } from "./pages/RepositoryImport";
import { RepositoryLayout } from "./components/layout/RepositoryLayout";
import { RepositoryOverview } from "./pages/RepositoryOverview";
import { RepositoryChat } from "./pages/RepositoryChat";
import { PullRequests } from "./pages/PullRequests";
import { PullRequestReview } from "./pages/PullRequestReview";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/NotFound";
import { RepositoryArchitecture } from "./pages/RepositoryArchitecture";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/success" element={<AuthSuccess />} />
          <Route element={<AppShell />}>
            <Route path="/repositories" element={<Repositories />} />
            <Route path="/repositories/new" element={<RepositoryImport />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/repositories/:id" element={<RepositoryLayout />}>
              <Route index element={<RepositoryOverview />} />
              <Route path="chat" element={<RepositoryChat />} />
              <Route path="pull-requests" element={<PullRequests />} />
              <Route path="pull-requests/:prId" element={<PullRequestReview />} />
              <Route path="architecture" element={<RepositoryArchitecture />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
