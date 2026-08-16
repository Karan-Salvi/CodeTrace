import { Navigate } from "react-router-dom";
import { CardSoft, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function Login() {
  const { token, isLoading } = useAuth();

  if (!isLoading && token) {
    return <Navigate to="/repositories" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <CardSoft className="w-full max-w-md p-xl rounded-lg">
        <CardHeader className="text-center pb-lg">
          <CardTitle className="text-[24px]">Welcome to CodeTrace</CardTitle>
          <p className="text-body text-[16px] mt-2">Log in to manage your repositories</p>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button 
            className="w-full"
            onClick={() => {
              window.location.href = `${API_BASE_URL}/auth/github`;
            }}
          >
            Continue with GitHub
          </Button>
        </CardContent>
      </CardSoft>
    </div>
  );
}
