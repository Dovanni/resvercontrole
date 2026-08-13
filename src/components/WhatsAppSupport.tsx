import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface WhatsAppSupportProps {
  message?: string;
  variant?: "floating" | "link";
  className?: string;
}

export function WhatsAppSupport({ 
  message = "Olá! Preciso de ajuda com o VEJAMAIS.", 
  variant = "floating",
  className = "" 
}: WhatsAppSupportProps) {
  const phoneNumber = "5517992822622";
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

  const handleClick = () => {
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`text-primary hover:underline font-medium text-sm flex items-center gap-2 ${className}`}
        aria-label="Falar com o suporte VEJAMAIS pelo WhatsApp"
      >
        <MessageCircle className="size-4" />
        Precisa de ajuda? Fale conosco pelo WhatsApp
      </button>
    );
  }

  return (
    <div className={`fixed bottom-20 right-6 z-50 flex items-center gap-3 ${className} md:bottom-8 md:right-8 print:hidden`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleClick}
            size="icon"
            className="size-12 rounded-full bg-[#25D366] hover:bg-[#20BA56] text-white shadow-lg hover:shadow-xl transition-all active:scale-95 border-none"
            aria-label="Falar com o suporte VEJAMAIS pelo WhatsApp"
          >
            <MessageCircle className="size-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="font-medium">
          Falar pelo WhatsApp
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
