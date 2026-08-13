import { MessageCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

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
  const encodedMessage = typeof window !== 'undefined' ? encodeURIComponent(message) : '';
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

  if (variant === "link") {
    return (
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-primary hover:underline font-medium text-sm inline-flex items-center gap-2 ${className}`}
        aria-label="Falar com o suporte VEJAMAIS pelo WhatsApp"
      >
        <MessageCircle className="size-4" />
        Precisa de ajuda? Fale conosco pelo WhatsApp
      </a>
    );
  }

  const FloatingButton = (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed bottom-20 right-6 z-50 flex items-center justify-center size-12 rounded-full bg-[#25D366] hover:bg-[#20BA56] text-white shadow-lg hover:shadow-xl transition-all active:scale-95 border-none md:bottom-8 md:right-8 print:hidden ${className}`}
      aria-label="Falar com o suporte VEJAMAIS pelo WhatsApp"
    >
      <MessageCircle className="size-6" />
    </a>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {FloatingButton}
        </TooltipTrigger>
        <TooltipContent side="left" className="font-medium">
          Falar pelo WhatsApp
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
