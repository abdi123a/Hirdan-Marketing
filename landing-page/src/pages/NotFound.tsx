import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center px-6">
      <h1 className="text-6xl font-display font-bold text-primary-foreground mb-4">404</h1>
      <p className="text-xl text-primary-foreground/60 mb-8 font-body">Page not found</p>
      <Button variant="hero" onClick={() => navigate("/")}>
        Go Home
      </Button>
    </div>
  );
};

export default NotFound;
