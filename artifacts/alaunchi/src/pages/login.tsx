import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden">
      {/* Background artwork placeholder / gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/10 via-background to-background z-0" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10 flex flex-col items-center max-w-sm w-full p-8 border border-white/5 bg-card/80 backdrop-blur-md rounded-2xl shadow-2xl"
      >
        <img 
          src="/logo.png" 
          alt="ALaunchi" 
          className="h-16 mb-8 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <div className="hidden mb-8 text-4xl font-bold tracking-tighter text-white">
          <span className="bg-accent text-accent-foreground px-2 py-1 rounded">AL</span>aunchi
        </div>

        <Button 
          size="lg" 
          className="w-full bg-white text-black hover:bg-gray-200 transition-colors h-14 text-base font-semibold"
          onClick={() => login()}
        >
          <MicrosoftIcon className="mr-2 h-5 w-5" />
          Iniciar sesión con Microsoft
        </Button>
        <p className="mt-6 text-xs text-muted-foreground text-center">
          Necesitas una cuenta de Minecraft comprada para usar ALaunchi.
        </p>
      </motion.div>
    </div>
  );
}
