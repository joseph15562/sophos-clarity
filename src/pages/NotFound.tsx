import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto px-6 space-y-6">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="text-3xl font-display font-black text-primary">404</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-display font-bold text-foreground tracking-tight">Page not found</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The page <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{location.pathname}</code> doesn't exist or has been moved.
          </p>
        </div>
        <Button asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to FireComply
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
