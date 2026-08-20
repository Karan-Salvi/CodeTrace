import { Outlet, Link, useLocation, useParams } from "react-router-dom";
import { cn } from "../../lib/utils";

export function RepositoryLayout() {
  const { id } = useParams();
  const location = useLocation();

  const isOverview = location.pathname === `/repositories/${id}`;
  const isChat = location.pathname === `/repositories/${id}/chat`;
  const isPullRequests = location.pathname === `/repositories/${id}/pull-requests`;

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-140px)] w-full gap-lg">
      <aside className="w-full md:w-64 flex-shrink-0 flex flex-col gap-xs">
        <Link 
          to={`/repositories/${id}`} 
          className={cn(
            "block rounded-sm px-sm py-xs text-[14px] font-medium transition-colors",
            isOverview 
              ? "bg-canvas-soft text-ink shadow-[inset_3px_0_0_0_var(--color-primary)]" 
              : "text-body hover:text-ink hover:bg-canvas-soft"
          )}
        >
          Overview
        </Link>
        <Link 
          to={`/repositories/${id}/chat`} 
          className={cn(
            "block rounded-sm px-sm py-xs text-[14px] font-medium transition-colors",
            isChat 
              ? "bg-canvas-soft text-ink shadow-[inset_3px_0_0_0_var(--color-primary)]" 
              : "text-body hover:text-ink hover:bg-canvas-soft"
          )}
        >
          Chat
        </Link>
        <Link 
          to={`/repositories/${id}/pull-requests`} 
          className={cn(
            "block rounded-sm px-sm py-xs text-[14px] font-medium transition-colors",
            isPullRequests 
              ? "bg-canvas-soft text-ink shadow-[inset_3px_0_0_0_var(--color-primary)]" 
              : "text-body hover:text-ink hover:bg-canvas-soft"
          )}
        >
          Pull Requests
        </Link>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
